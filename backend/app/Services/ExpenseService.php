<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\ExpenseBill;
use App\Models\ExpenseClaim;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Realtime;
use App\Support\Recipients;
use App\Support\TenantCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ExpenseService
{
    private const DISK = 'local';

    public function __construct(private readonly NotificationService $notifications) {}

    /* ---------------------------------------------------------------- apply */

    public function apply(User $actor, array $data, array $files = []): ExpenseClaim
    {
        $employee = $this->employeeFor($actor, isset($data['employee_id']) ? (int) $data['employee_id'] : null);
        $date = Carbon::parse($data['expense_date'])->startOfDay();
        $amount = round((float) $data['amount'], 2);
        $category = (string) $data['category'];
        $purpose = $this->purposeFor($category, $data);

        $this->assertDate($employee, $date);
        $this->assertAmount($amount);

        $claim = DB::transaction(function () use ($employee, $date, $amount, $category, $purpose, $data, $actor, $files): ExpenseClaim {
            $claim = new ExpenseClaim([
                'category' => $category,
                'purpose' => $purpose,
                'expense_date' => $date->toDateString(),
                'amount' => $amount,
                'description' => $data['description'],
            ]);

            $claim->company_id = $employee->company_id;
            $claim->employee_id = $employee->id;
            $claim->applied_by = $actor->id;
            $claim->created_by = $actor->id;
            $claim->save();

            foreach ($files as $file) {
                $this->storeBill($claim, $file, $actor);
            }

            $this->flush();

            return $claim->refresh()->load('employee.user', 'bills');
        });

        $this->notifyManager($claim, $actor);
        $this->broadcast($claim);

        return $claim;
    }

    public function update(ExpenseClaim $claim, array $data, User $actor): ExpenseClaim
    {
        $this->assertOwner($claim, $actor);

        if (! $claim->isPending()) {
            throw new ApiException(
                'Manager ke paas jaane ke baad claim edit nahi hoti. Cancel karke nayi banao.',
                409,
                'EXPENSE_NOT_EDITABLE'
            );
        }

        $date = isset($data['expense_date'])
            ? Carbon::parse($data['expense_date'])->startOfDay()
            : $claim->expense_date;

        $amount = isset($data['amount']) ? round((float) $data['amount'], 2) : (float) $claim->amount;
        $category = $data['category'] ?? $claim->category;

        $this->assertDate($claim->employee, $date);
        $this->assertAmount($amount);

        $claim->fill([
            'category' => $category,
            'purpose' => $this->purposeFor($category, $data, $claim->purpose),
            'expense_date' => $date->toDateString(),
            'amount' => $amount,
            'description' => $data['description'] ?? $claim->description,
        ]);

        $claim->updated_by = $actor->id;
        $claim->save();

        $this->flush();

        return $claim->refresh()->load('employee.user', 'bills');
    }

    /* ------------------------------------------------------- manager stage */

    public function approve(ExpenseClaim $claim, array $data, User $actor): ExpenseClaim
    {
        $this->assertCanApprove($claim, $actor);

        if (! $claim->isPending()) {
            throw new ApiException(
                'Ye claim ab manager stage par nahi hai — abhi ' . $claim->stageLabel() . '.',
                409,
                'EXPENSE_WRONG_STAGE'
            );
        }

        $claim->forceFill([
            'status' => ExpenseClaim::MANAGER_APPROVED,
            'approver_id' => $actor->id,
            'approved_at' => Carbon::now(),
            'approver_remarks' => $data['remarks'] ?? null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $claim = $claim->refresh()->load('employee.user', 'approver');

        $this->notifyEmployee($claim, $actor, NotificationType::EXPENSE_APPROVED);
        $this->notifyVerifiers($claim, $actor);
        $this->broadcast($claim);

        return $claim;
    }

    /* ------------------------------------------------------------ HR stage */

    public function verify(ExpenseClaim $claim, array $data, User $actor): ExpenseClaim
    {
        $this->assertPermission($actor, ExpenseClaim::VERIFY_PERMISSION, 'verify karne');

        if (! $claim->isManagerApproved()) {
            throw new ApiException(
                $claim->isPending()
                    ? 'Pehle manager approve karega, tab HR verify karegi.'
                    : 'Ye claim ab verification stage par nahi hai — abhi ' . $claim->stageLabel() . '.',
                409,
                'EXPENSE_WRONG_STAGE'
            );
        }

        $approved = isset($data['approved_amount'])
            ? round((float) $data['approved_amount'], 2)
            : (float) $claim->amount;

        $this->assertAmount($approved);

        if ($approved > (float) $claim->amount) {
            throw new ApiException(
                'Approved amount claim se zyada nahi ho sakta (claim ' . $claim->amount . ').',
                422,
                'EXPENSE_AMOUNT_EXCEEDS_CLAIM'
            );
        }

        if ($approved < (float) $claim->amount && ($data['remarks'] ?? null) === null) {
            throw new ApiException(
                'Amount kam kar rahe ho to wajah likhni zaroori hai.',
                422,
                'EXPENSE_REMARKS_REQUIRED'
            );
        }

        $claim->forceFill([
            'status' => ExpenseClaim::VERIFIED,
            'approved_amount' => $approved,
            'verified_by' => $actor->id,
            'verified_at' => Carbon::now(),
            'verify_remarks' => $data['remarks'] ?? null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $claim = $claim->refresh()->load('employee.user', 'verifier');

        $this->notifyEmployee($claim, $actor, NotificationType::EXPENSE_VERIFIED);
        $this->notifyPayers($claim, $actor);
        $this->broadcast($claim);

        return $claim;
    }

    /* ------------------------------------------------------------- payment */

    public function pay(ExpenseClaim $claim, array $data, User $actor): ExpenseClaim
    {
        $this->assertPermission($actor, ExpenseClaim::PAY_PERMISSION, 'payment karne');

        if (! $claim->isVerified()) {
            throw new ApiException(
                $claim->status === ExpenseClaim::PAID
                    ? 'Ye claim already paid hai.'
                    : 'HR verification ke bina payment nahi ho sakta — abhi ' . $claim->stageLabel() . '.',
                409,
                'EXPENSE_NOT_PAYABLE'
            );
        }

        $paidOn = isset($data['paid_on']) ? Carbon::parse($data['paid_on'])->startOfDay() : Carbon::today();

        if ($paidOn->greaterThan(Carbon::today())) {
            throw new ApiException('Payment ki date aane wale din ki nahi ho sakti.', 422, 'EXPENSE_DATE_INVALID');
        }

        $claim->forceFill([
            'status' => ExpenseClaim::PAID,
            'paid_by' => $actor->id,
            'paid_on' => $paidOn->toDateString(),
            'payment_mode' => $data['payment_mode'],
            'payment_reference' => $data['payment_reference'] ?? null,
            'payment_remarks' => $data['payment_remarks'] ?? null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $claim = $claim->refresh()->load('employee.user', 'payer');

        $this->notifyEmployee($claim, $actor, NotificationType::EXPENSE_PAID);
        $this->broadcast($claim);

        return $claim;
    }

    public function payMany(array $uuids, array $data, User $actor): array
    {
        $this->assertPermission($actor, ExpenseClaim::PAY_PERMISSION, 'payment karne');

        $paid = 0;
        $total = 0.0;
        $skipped = [];

        foreach (array_unique($uuids) as $uuid) {
            $claim = ExpenseClaim::query()->where('uuid', $uuid)->first();

            if ($claim === null) {
                $skipped[] = ['uuid' => $uuid, 'reason' => 'Claim nahi mila'];

                continue;
            }

            if (! $claim->isVerified()) {
                $skipped[] = ['uuid' => $uuid, 'reason' => $claim->stageLabel()];

                continue;
            }

            $amount = $claim->payable();
            $this->pay($claim, $data, $actor);
            $paid++;
            $total += $amount;
        }

        return [
            'paid' => $paid,
            'total_amount' => round($total, 2),
            'skipped' => $skipped,
        ];
    }

    /* -------------------------------------------------------------- reject */

    public function reject(ExpenseClaim $claim, array $data, User $actor): ExpenseClaim
    {
        if ($claim->isClosed()) {
            throw new ApiException('Ye claim already ' . $claim->status . ' hai.', 409, 'EXPENSE_ALREADY_CLOSED');
        }

        $stage = $claim->isPending() ? ExpenseClaim::STAGE_MANAGER : ExpenseClaim::STAGE_HR;

        if ($stage === ExpenseClaim::STAGE_MANAGER) {
            $this->assertCanApprove($claim, $actor);
        } else {
            $this->assertPermission($actor, ExpenseClaim::VERIFY_PERMISSION, 'reject karne');
        }

        $claim->forceFill([
            'status' => ExpenseClaim::REJECTED,
            'rejected_by' => $actor->id,
            'rejected_at' => Carbon::now(),
            'reject_reason' => $data['reason'],
            'rejected_stage' => $stage,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $claim = $claim->refresh()->load('employee.user');

        $this->notifyEmployee($claim, $actor, NotificationType::EXPENSE_REJECTED);
        $this->broadcast($claim);

        return $claim;
    }

    public function cancel(ExpenseClaim $claim, User $actor): ExpenseClaim
    {
        $this->assertOwner($claim, $actor);

        if (! $claim->isPending()) {
            throw new ApiException(
                'Manager ke paas jaane ke baad cancel nahi hoti — ' . $claim->stageLabel() . '.',
                409,
                'EXPENSE_NOT_CANCELLABLE'
            );
        }

        $claim->forceFill([
            'status' => ExpenseClaim::CANCELLED,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $this->broadcast($claim);

        return $claim->refresh()->load('employee.user');
    }

    /* --------------------------------------------------------------- bills */

    public function addBill(ExpenseClaim $claim, UploadedFile $file, User $actor): ExpenseBill
    {
        $this->assertOwner($claim, $actor);

        if ($claim->isClosed()) {
            throw new ApiException('Band claim mein bill nahi jud sakta.', 409, 'EXPENSE_ALREADY_CLOSED');
        }

        return DB::transaction(function () use ($claim, $file, $actor): ExpenseBill {
            $bill = $this->storeBill($claim, $file, $actor);
            $this->flush();

            return $bill->refresh()->load('uploader');
        });
    }

    public function deleteBill(ExpenseBill $bill, User $actor): void
    {
        $claim = $bill->claim;

        if ($claim === null || ! $claim->isPending()) {
            throw new ApiException(
                'Manager ke paas jaane ke baad bill nahi hata sakte.',
                409,
                'EXPENSE_NOT_EDITABLE'
            );
        }

        $this->assertOwner($claim, $actor);

        DB::transaction(function () use ($bill): void {
            if (Storage::disk(self::DISK)->exists($bill->file_path)) {
                Storage::disk(self::DISK)->delete($bill->file_path);
            }

            $bill->deactivate();
            $this->flush();
        });
    }

    public function downloadBill(ExpenseBill $bill): StreamedResponse
    {
        if (! Storage::disk(self::DISK)->exists($bill->file_path)) {
            throw new ApiException('Ye bill ab available nahi hai.', 404, 'FILE_MISSING');
        }

        return Storage::disk(self::DISK)->download($bill->file_path, $bill->original_name);
    }

    /* ------------------------------------------------------------- summary */

    public function summary(User $actor, ?int $employeeId, string $month): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $employee = $this->employeeFor($actor, $employeeId);

        $rows = DB::table('expense_claims')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->whereBetween('expense_date', [$start->toDateString(), $end->toDateString()])
            ->groupBy('category')
            ->get([
                'category',
                DB::raw('COUNT(*) as claims'),
                DB::raw("COALESCE(SUM(CASE WHEN status = 'paid' THEN payable_amount ELSE 0 END), 0) as paid"),
                DB::raw("COALESCE(SUM(CASE WHEN status IN ('pending','manager_approved','verified') THEN payable_amount ELSE 0 END), 0) as in_process"),
                DB::raw("COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END), 0) as rejected"),
            ]);

        $categories = $rows->map(fn ($row): array => [
            'category' => $row->category,
            'label' => ExpenseClaim::CATEGORIES[$row->category] ?? $row->category,
            'claims' => (int) $row->claims,
            'paid' => round((float) $row->paid, 2),
            'in_process' => round((float) $row->in_process, 2),
            'rejected' => round((float) $row->rejected, 2),
        ])->all();

        $counts = DB::table('expense_claims')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->whereBetween('expense_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw("
                COUNT(*) as total,
                SUM(status = 'pending') as pending,
                SUM(status = 'manager_approved') as awaiting_hr,
                SUM(status = 'verified') as awaiting_payment,
                SUM(status = 'paid') as paid,
                SUM(status = 'rejected') as rejected
            ")
            ->first();

        return [
            'month' => $start->format('Y-m'),
            'employee_id' => (int) $employee->id,
            'employee_name' => $employee->user?->name,
            'claims' => [
                'total' => (int) $counts->total,
                'pending_manager' => (int) $counts->pending,
                'pending_hr' => (int) $counts->awaiting_hr,
                'pending_payment' => (int) $counts->awaiting_payment,
                'paid' => (int) $counts->paid,
                'rejected' => (int) $counts->rejected,
            ],
            'amount' => [
                'in_process' => round(array_sum(array_column($categories, 'in_process')), 2),
                'paid' => round(array_sum(array_column($categories, 'paid')), 2),
            ],
            'categories' => $categories,
        ];
    }

    public function pendingPayout(User $actor): array
    {
        $this->assertPermission($actor, ExpenseClaim::PAY_PERMISSION, 'payment dekhne');

        $rows = DB::table('expense_claims as c')
            ->join('employees as e', 'e.id', '=', 'c.employee_id')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->where('c.company_id', $actor->company_id)
            ->where('c.status', ExpenseClaim::VERIFIED)
            ->where('c.is_active', 1)
            ->orderBy('c.verified_at')
            ->get([
                'c.uuid', 'c.id', 'c.category', 'c.purpose', 'c.expense_date',
                'c.payable_amount', 'c.verified_at',
                'e.employee_code', 'u.name as employee_name',
            ]);

        return [
            'count' => $rows->count(),
            'total_amount' => round((float) $rows->sum('payable_amount'), 2),
            'claims' => $rows->map(fn ($row): array => [
                'uuid' => $row->uuid,
                'claim_id' => (int) $row->id,
                'employee_code' => $row->employee_code,
                'employee_name' => $row->employee_name,
                'category' => $row->category,
                'purpose' => $row->purpose,
                'expense_date' => $row->expense_date,
                'amount' => round((float) $row->payable_amount, 2),
                'verified_at' => $row->verified_at,
            ])->all(),
        ];
    }

    /* --------------------------------------------------------------- guards */

    private function storeBill(ExpenseClaim $claim, UploadedFile $file, User $actor): ExpenseBill
    {
        $path = $file->storeAs(
            'expenses/' . $claim->company_id . '/' . $claim->id,
            Str::uuid()->toString() . '.' . strtolower($file->getClientOriginalExtension() ?: 'bin'),
            self::DISK
        );

        $bill = new ExpenseBill([
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize() ?: 0,
        ]);

        $bill->company_id = $claim->company_id;
        $bill->expense_claim_id = $claim->id;
        $bill->uploaded_by = $actor->id;
        $bill->created_by = $actor->id;
        $bill->save();

        return $bill;
    }

    private function purposeFor(string $category, array $data, ?string $current = null): ?string
    {
        if ($category !== ExpenseClaim::OTHER) {
            return null;
        }

        $purpose = $data['purpose'] ?? $current;

        if ($purpose === null || trim((string) $purpose) === '') {
            throw new ApiException(
                'Other chuna hai to batao kis liye — jaise "Laptop repair karaya".',
                422,
                'EXPENSE_PURPOSE_REQUIRED'
            );
        }

        return trim((string) $purpose);
    }

    private function assertAmount(float $amount): void
    {
        if ($amount <= 0) {
            throw new ApiException('Amount 0 se zyada hona chahiye.', 422, 'EXPENSE_AMOUNT_INVALID');
        }
    }

    private function assertDate(Employee $employee, Carbon $date): void
    {
        if ($date->greaterThan(Carbon::today())) {
            throw new ApiException('Aane wale din ka kharcha claim nahi hota.', 422, 'EXPENSE_FUTURE_DATE');
        }

        $days = $this->windowDays($employee);

        if ($date->lessThan(Carbon::today()->subDays($days))) {
            throw new ApiException(
                'Sirf pichle ' . $days . ' din ka kharcha claim ho sakta hai.',
                422,
                'EXPENSE_WINDOW_CLOSED'
            );
        }
    }

    private function windowDays(Employee $employee): int
    {
        $days = DB::table('companies')->where('id', $employee->company_id)->value('expense_claim_days');

        return $days === null ? ExpenseClaim::DEFAULT_WINDOW_DAYS : (int) $days;
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        if ($employeeId === null) {
            $employee = Employee::query()->with('user')->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Reimbursement ke liye employee record chahiye. HR se onboarding karwao.',
                    422,
                    'EMPLOYEE_RECORD_MISSING'
                );
            }

            return $employee;
        }

        if (! $actor->isSuperAdmin() && ! $actor->hasPermission(ExpenseClaim::VERIFY_PERMISSION)) {
            throw new ApiException('Kisi aur ki claim daalne ki permission nahi hai.', 403, 'FORBIDDEN');
        }

        $employee = Employee::query()->with('user')->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }

    private function assertOwner(ExpenseClaim $claim, User $actor): void
    {
        if ((int) $claim->employee->user_id === (int) $actor->id || $actor->isSuperAdmin()) {
            return;
        }

        throw new ApiException('Ye claim aapki nahi hai.', 403, 'FORBIDDEN');
    }

    private function assertCanApprove(ExpenseClaim $claim, User $actor): void
    {
        if ((int) $claim->employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Apni claim khud approve nahi kar sakte.', 403, 'EXPENSE_SELF_APPROVAL');
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(ExpenseClaim::VERIFY_PERMISSION)) {
            return;
        }

        if ((int) $claim->employee->reporting_manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Aap is claim par decision nahi le sakte.', 403, 'FORBIDDEN');
    }

    private function assertPermission(User $actor, string $permission, string $what): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission($permission)) {
            return;
        }

        throw new ApiException('Aapke paas ' . $what . ' ka haq nahi hai.', 403, 'FORBIDDEN');
    }

    /* -------------------------------------------------------- notifications */

    private function notifyManager(ExpenseClaim $claim, User $actor): void
    {
        $employee = $claim->employee;
        $name = $employee->user?->name ?? $employee->employee_code;

        $this->notifications->sendMany(
            Recipients::approversFor($employee, ExpenseClaim::VERIFY_PERMISSION),
            [
                'type' => NotificationType::EXPENSE_APPLIED,
                'title' => $name . ' ne reimbursement bheji hai',
                'body' => $claim->amount . ' — ' . $claim->categoryLabel()
                    . ' · ' . $claim->expense_date->format('d M Y'),
                'action_url' => '/expense-claims/' . $claim->uuid,
                'entity_type' => 'expense_claim',
                'entity_id' => $claim->id,
                'payload' => $this->payload($claim),
                'dedupe_key' => 'expense:' . $claim->id . ':applied',
            ],
            $actor
        );
    }

    private function notifyVerifiers(ExpenseClaim $claim, User $actor): void
    {
        $employee = $claim->employee;
        $name = $employee->user?->name ?? $employee->employee_code;

        $recipients = Recipients::except(
            Recipients::withPermission((int) $claim->company_id, ExpenseClaim::VERIFY_PERMISSION),
            [(int) $employee->user_id, (int) $actor->id]
        );

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::EXPENSE_VERIFY_PENDING,
            'title' => $name . ' ki claim verify karni hai',
            'body' => $claim->amount . ' — ' . $claim->categoryLabel() . ' · manager ne approve kar diya',
            'action_url' => '/expense-claims/' . $claim->uuid,
            'entity_type' => 'expense_claim',
            'entity_id' => $claim->id,
            'payload' => $this->payload($claim),
            'dedupe_key' => 'expense:' . $claim->id . ':verify',
        ], $actor);
    }

    private function notifyPayers(ExpenseClaim $claim, User $actor): void
    {
        $recipients = Recipients::except(
            Recipients::withPermission((int) $claim->company_id, ExpenseClaim::PAY_PERMISSION),
            [(int) $claim->employee->user_id, (int) $actor->id]
        );

        if ($recipients === []) {
            return;
        }

        $name = $claim->employee->user?->name ?? $claim->employee->employee_code;

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::EXPENSE_PAYMENT_PENDING,
            'title' => 'Payment pending: ' . $name,
            'body' => $claim->payable() . ' verify ho chuki hai — payment karna hai',
            'action_url' => '/expense-claims/pending-payout',
            'entity_type' => 'expense_claim',
            'entity_id' => $claim->id,
            'payload' => $this->payload($claim),
            'dedupe_key' => 'expense:' . $claim->id . ':pay',
        ], $actor);
    }

    private function notifyEmployee(ExpenseClaim $claim, User $actor, string $type): void
    {
        $body = match ($type) {
            NotificationType::EXPENSE_APPROVED => 'Manager ne approve kar diya — ab HR verify karegi.',
            NotificationType::EXPENSE_VERIFIED => 'HR ne verify kar diya — ' . $claim->payable()
                . ' payment ka intezaar hai.'
                . ($claim->payable() < (float) $claim->amount && $claim->verify_remarks !== null
                    ? ' (' . $claim->verify_remarks . ')'
                    : ''),
            NotificationType::EXPENSE_PAID => $claim->payable() . ' ' . $claim->payment_mode
                . ' se ' . $claim->paid_on?->format('d M Y') . ' ko de di gayi.',
            NotificationType::EXPENSE_REJECTED => ($claim->rejected_stage === ExpenseClaim::STAGE_MANAGER ? 'Manager' : 'HR')
                . ' ne reject kiya — ' . $claim->reject_reason,
            default => '',
        };

        $title = match ($type) {
            NotificationType::EXPENSE_APPROVED => 'Reimbursement approve ho gayi',
            NotificationType::EXPENSE_VERIFIED => 'Reimbursement verify ho gayi',
            NotificationType::EXPENSE_PAID => 'Reimbursement mil gayi',
            NotificationType::EXPENSE_REJECTED => 'Reimbursement reject ho gayi',
            default => 'Reimbursement update',
        };

        $this->notifications->send((int) $claim->employee->user_id, [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => '/expense-claims/' . $claim->uuid,
            'entity_type' => 'expense_claim',
            'entity_id' => $claim->id,
            'payload' => $this->payload($claim),
        ], $actor);
    }

    private function broadcast(ExpenseClaim $claim): void
    {
        $employee = $claim->employee;

        Realtime::toUsers(
            array_merge(
                Recipients::approversFor($employee, ExpenseClaim::VERIFY_PERMISSION),
                [(int) $employee->user_id]
            ),
            'expense.changed',
            $this->payload($claim)
        );
    }

    private function payload(ExpenseClaim $claim): array
    {
        return [
            'claim_id' => (int) $claim->id,
            'claim_uuid' => $claim->uuid,
            'employee_id' => (int) $claim->employee_id,
            'employee_name' => $claim->employee->user?->name,
            'category' => $claim->category,
            'purpose' => $claim->purpose,
            'expense_date' => $claim->expense_date->toDateString(),
            'amount' => (float) $claim->amount,
            'payable_amount' => $claim->payable(),
            'status' => $claim->status,
            'stage' => $claim->stageLabel(),
        ];
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::EXPENSES);
    }
}

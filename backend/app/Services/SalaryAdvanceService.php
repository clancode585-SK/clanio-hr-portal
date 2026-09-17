<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Employee;
use App\Models\SalaryAdvance;
use App\Models\SalaryAdvanceRecovery;
use App\Models\User;
use App\Support\NotificationType;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SalaryAdvanceService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly SalaryStructureService $structures,
    ) {}

    public function request(Employee $employee, array $data, User $actor): SalaryAdvance
    {
        $company = Company::query()->findOrFail($employee->company_id);

        if (! $company->advance_enabled) {
            throw new ApiException('Is company me advance salary band hai.', 422, 'ADVANCE_DISABLED');
        }

        $open = SalaryAdvance::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', [SalaryAdvance::PENDING, SalaryAdvance::APPROVED, SalaryAdvance::DISBURSED])
            ->first();

        if ($open !== null) {
            throw new ApiException(
                'Ek advance already chal raha hai (' . $open->reference . ') — pehle wo pura karo.',
                422,
                'ADVANCE_ALREADY_OPEN'
            );
        }

        $amount = round((float) $data['amount'], 2);
        $tenure = (int) $data['tenure_months'];

        $this->assertWithinCap($employee, $company, $amount, $tenure);

        $emi = isset($data['emi_amount']) && $data['emi_amount'] !== null
            ? round((float) $data['emi_amount'], 2)
            : round($amount / max(1, $tenure), 2);

        $advance = new SalaryAdvance();
        $advance->company_id = $employee->company_id;
        $advance->employee_id = $employee->id;
        $advance->created_by = $actor->id;

        $advance->forceFill([
            'employee_code' => $employee->employee_code,
            'employee_name' => $employee->user?->name ?? 'Employee',
            'reference' => $this->nextReference((int) $employee->company_id),
            'amount' => $amount,
            'emi_amount' => $emi,
            'tenure_months' => $tenure,
            'outstanding' => $amount,
            'recovered' => 0,
            'reason' => $data['reason'],
            'status' => SalaryAdvance::PENDING,
            'payment_status' => SalaryAdvance::PAY_PENDING,
            'requested_at' => Carbon::now(),
        ])->save();

        $this->tellApprovers($advance, $actor);

        return $advance->refresh();
    }

    public function decide(SalaryAdvance $advance, bool $approve, ?string $note, User $actor): SalaryAdvance
    {
        if (! $advance->isPending()) {
            throw new ApiException(
                'Ye request pehle hi ' . $advance->statusLabel() . ' hai.',
                409,
                'ADVANCE_DECIDED'
            );
        }

        $advance->forceFill([
            'status' => $approve ? SalaryAdvance::APPROVED : SalaryAdvance::REJECTED,
            'decision_note' => $note,
            'decided_at' => Carbon::now(),
            'decided_by' => $actor->id,
            'updated_by' => $actor->id,
        ])->save();

        $this->tellEmployee(
            $advance,
            $approve ? NotificationType::ADVANCE_APPROVED : NotificationType::ADVANCE_REJECTED,
            $approve ? 'Advance approve ho gaya' : 'Advance reject ho gaya',
            $approve
                ? 'Aapka ₹' . number_format((float) $advance->amount, 2) . ' ka advance approve ho gaya hai. Transfer ka intezaar karo.'
                : 'Aapka advance request reject ho gaya' . ($note ? ' — ' . $note : '.'),
            $actor
        );

        return $advance->refresh();
    }

    // HR EMI kam ya zyada kar sakta hai — transfer ke baad bhi
    public function updatePlan(SalaryAdvance $advance, array $data, User $actor): SalaryAdvance
    {
        if (in_array($advance->status, [SalaryAdvance::REJECTED, SalaryAdvance::CLOSED, SalaryAdvance::CANCELLED], true)) {
            throw new ApiException('Ye advance band ho chuka hai.', 409, 'ADVANCE_CLOSED');
        }

        $emi = round((float) $data['emi_amount'], 2);

        if ($emi <= 0) {
            throw new ApiException('EMI zero se zyada honi chahiye.', 422, 'EMI_INVALID');
        }

        $remaining = $advance->isDisbursed() ? (float) $advance->outstanding : (float) $advance->amount;

        if ($emi > $remaining) {
            throw new ApiException(
                'EMI baaki amount (₹' . number_format($remaining, 2) . ') se zyada nahi ho sakti.',
                422,
                'EMI_TOO_BIG'
            );
        }

        $advance->forceFill([
            'emi_amount' => $emi,
            'tenure_months' => (int) ceil($remaining / $emi),
            'start_period' => $data['start_period'] ?? $advance->start_period,
            'updated_by' => $actor->id,
        ])->save();

        return $advance->refresh();
    }

    public function hold(SalaryAdvance $advance, ?string $reason, User $actor): SalaryAdvance
    {
        $advance->forceFill([
            'payment_status' => SalaryAdvance::ON_HOLD,
            'hold_reason' => $reason,
            'updated_by' => $actor->id,
        ])->save();

        return $advance->refresh();
    }

    public function release(SalaryAdvance $advance, User $actor): SalaryAdvance
    {
        $advance->forceFill([
            'payment_status' => SalaryAdvance::PAY_PENDING,
            'hold_reason' => null,
            'updated_by' => $actor->id,
        ])->save();

        return $advance->refresh();
    }

    public function cancel(SalaryAdvance $advance, User $actor): SalaryAdvance
    {
        if ($advance->isDisbursed() && (float) $advance->recovered > 0) {
            throw new ApiException(
                'Iski EMI kat chuki hai — cancel nahi hoga.',
                409,
                'ADVANCE_IN_RECOVERY'
            );
        }

        if ($advance->payment_status === SalaryAdvance::PAY_PAID) {
            throw new ApiException('Paisa ja chuka hai — cancel nahi hoga.', 409, 'ADVANCE_PAID');
        }

        $advance->forceFill([
            'status' => SalaryAdvance::CANCELLED,
            'closed_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        return $advance->refresh();
    }

    // Transfer ke baad hi EMI shuru hoti hai
    public function markDisbursed(SalaryAdvance $advance, User $actor): SalaryAdvance
    {
        $now = Carbon::now();

        $advance->forceFill([
            'status' => SalaryAdvance::DISBURSED,
            'payment_status' => SalaryAdvance::PAY_PAID,
            'disbursed_at' => $now,
            'start_period' => $advance->start_period ?? $now->copy()->addMonthNoOverflow()->format('Y-m'),
            'outstanding' => round((float) $advance->amount - (float) $advance->recovered, 2),
            'updated_by' => $actor->id,
        ])->save();

        $this->tellEmployee(
            $advance,
            NotificationType::ADVANCE_PAID,
            'Advance transfer ho gaya',
            '₹' . number_format((float) $advance->amount, 2) . ' aapke account me bhej diya gaya hai. EMI '
                . $advance->start_period . ' se shuru hogi.',
            $actor
        );

        return $advance->refresh();
    }

    /** @return array<int, SalaryAdvance> employee_id => advance */
    public function recoveringFor(int $companyId, array $employeeIds, string $period): array
    {
        if ($employeeIds === []) {
            return [];
        }

        $rows = SalaryAdvance::query()
            ->where('company_id', $companyId)
            ->whereIn('employee_id', $employeeIds)
            ->where('status', SalaryAdvance::DISBURSED)
            ->where('outstanding', '>', 0)
            ->where(fn ($q) => $q->whereNull('start_period')->orWhere('start_period', '<=', $period))
            ->get();

        $out = [];

        foreach ($rows as $row) {
            $out[(int) $row->employee_id] = $row;
        }

        return $out;
    }

    public function recordRecovery(
        SalaryAdvance $advance,
        string $period,
        float $amount,
        string $source,
        ?int $runId = null,
        ?int $itemId = null,
        ?int $settlementId = null,
        ?User $actor = null
    ): void {
        if ($amount <= 0) {
            return;
        }

        DB::table('salary_advance_recoveries')->updateOrInsert(
            ['advance_id' => $advance->id, 'period' => $period, 'source' => $source],
            [
                'company_id' => $advance->company_id,
                'employee_id' => $advance->employee_id,
                'run_id' => $runId,
                'item_id' => $itemId,
                'settlement_id' => $settlementId,
                'amount' => round($amount, 2),
                'created_by' => $actor?->id,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]
        );
    }

    // Recalculate par purani EMI rows hat jaati hain, warna do baar gin jaati
    public function clearRun(int $runId): array
    {
        $ids = DB::table('salary_advance_recoveries')
            ->where('run_id', $runId)
            ->distinct()
            ->pluck('advance_id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        DB::table('salary_advance_recoveries')->where('run_id', $runId)->delete();

        return $ids;
    }

    public function clearItem(int $itemId): array
    {
        $ids = DB::table('salary_advance_recoveries')
            ->where('item_id', $itemId)
            ->distinct()
            ->pluck('advance_id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        DB::table('salary_advance_recoveries')->where('item_id', $itemId)->delete();

        return $ids;
    }

    public function clearSettlement(int $settlementId): array
    {
        $ids = DB::table('salary_advance_recoveries')
            ->where('settlement_id', $settlementId)
            ->distinct()
            ->pluck('advance_id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        DB::table('salary_advance_recoveries')->where('settlement_id', $settlementId)->delete();

        return $ids;
    }

    public function resync(array $advanceIds): void
    {
        $ids = array_values(array_unique(array_filter($advanceIds)));

        if ($ids === []) {
            return;
        }

        $sums = DB::table('salary_advance_recoveries')
            ->whereIn('advance_id', $ids)
            ->groupBy('advance_id')
            ->pluck(DB::raw('SUM(amount)'), 'advance_id')
            ->all();

        foreach (SalaryAdvance::query()->whereIn('id', $ids)->get() as $advance) {
            $recovered = round((float) ($sums[$advance->id] ?? 0), 2);
            $outstanding = round(max(0.0, (float) $advance->amount - $recovered), 2);

            $status = $advance->status;
            $closedAt = $advance->closed_at;

            if ($advance->isDisbursed() && $outstanding <= 0) {
                $status = SalaryAdvance::CLOSED;
                $closedAt = $closedAt ?? Carbon::now();
            } elseif ($advance->isClosed() && $outstanding > 0) {
                $status = SalaryAdvance::DISBURSED;
                $closedAt = null;
            }

            $advance->forceFill([
                'recovered' => $recovered,
                'outstanding' => $outstanding,
                'status' => $status,
                'closed_at' => $closedAt,
            ])->save();
        }
    }

    public function openFor(int $employeeId): ?SalaryAdvance
    {
        return SalaryAdvance::query()
            ->where('employee_id', $employeeId)
            ->where('status', SalaryAdvance::DISBURSED)
            ->where('outstanding', '>', 0)
            ->first();
    }

    public function schedule(SalaryAdvance $advance): array
    {
        $paid = $advance->recoveries()->get();
        $rows = [];

        foreach ($paid as $row) {
            $rows[] = [
                'period' => $row->period,
                'amount' => (float) $row->amount,
                'source' => $row->source,
                'status' => 'recovered',
            ];
        }

        $left = (float) $advance->outstanding;
        $emi = (float) $advance->emi_amount;
        $cursor = $this->nextPeriod($advance, $paid->max('period'));

        while ($left > 0 && $emi > 0 && count($rows) < 60) {
            $due = round(min($emi, $left), 2);
            $rows[] = ['period' => $cursor, 'amount' => $due, 'source' => 'payroll', 'status' => 'due'];
            $left = round($left - $due, 2);
            $cursor = Carbon::parse($cursor . '-01')->addMonthNoOverflow()->format('Y-m');
        }

        return $rows;
    }

    private function nextPeriod(SalaryAdvance $advance, ?string $lastPaid): string
    {
        if ($lastPaid !== null) {
            return Carbon::parse($lastPaid . '-01')->addMonthNoOverflow()->format('Y-m');
        }

        return $advance->start_period ?? Carbon::now()->addMonthNoOverflow()->format('Y-m');
    }

    private function assertWithinCap(Employee $employee, Company $company, float $amount, int $tenure): void
    {
        if ($amount <= 0) {
            throw new ApiException('Amount zero se zyada hona chahiye.', 422, 'AMOUNT_INVALID');
        }

        if ($tenure < 1 || $tenure > (int) $company->advance_max_tenure) {
            throw new ApiException(
                'EMI 1 se ' . $company->advance_max_tenure . ' mahine ke beech honi chahiye.',
                422,
                'TENURE_INVALID'
            );
        }

        $structure = $this->structures->forMonth($employee, Carbon::now()->format('Y-m'));

        if ($structure === null) {
            throw new ApiException(
                'Iska salary structure nahi bana — advance ki limit nikal nahi sakte.',
                422,
                'STRUCTURE_MISSING'
            );
        }

        $cap = round((float) $structure->monthly_gross * (float) $company->advance_max_multiplier, 2);

        if ($amount > $cap) {
            throw new ApiException(
                'Zyada se zyada ₹' . number_format($cap, 2) . ' mil sakta hai ('
                    . rtrim(rtrim((string) $company->advance_max_multiplier, '0'), '.') . 'x monthly gross).',
                422,
                'ADVANCE_OVER_CAP'
            );
        }
    }

    private function nextReference(int $companyId): string
    {
        $year = Carbon::now()->year;
        $prefix = 'ADV-' . $year . '-';

        $last = SalaryAdvance::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('reference', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('reference');

        $next = $last === null ? 1 : ((int) substr((string) $last, -4)) + 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function tellApprovers(SalaryAdvance $advance, User $actor): void
    {
        $approvers = User::query()
            ->where('company_id', $advance->company_id)
            ->where('id', '!=', $actor->id)
            ->get()
            ->filter(fn (User $user): bool => $user->hasPermission(SalaryAdvance::APPROVE_PERMISSION));

        foreach ($approvers as $approver) {
            $this->notifications->send((int) $approver->id, [
                'type' => NotificationType::ADVANCE_REQUESTED,
                'title' => 'Naya advance request',
                'body' => $advance->employee_name . ' ne ₹' . number_format((float) $advance->amount, 2)
                    . ' ka advance manga hai.',
                'action_url' => '/advances',
                'entity_type' => 'salary_advance',
                'entity_id' => $advance->id,
            ], $actor);
        }
    }

    private function tellEmployee(SalaryAdvance $advance, string $type, string $title, string $body, ?User $actor): void
    {
        $userId = $advance->employee?->user_id;

        if ($userId === null) {
            return;
        }

        $this->notifications->send((int) $userId, [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => '/my-requests',
            'entity_type' => 'salary_advance',
            'entity_id' => $advance->id,
        ], $actor);
    }
}

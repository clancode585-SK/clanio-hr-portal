<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeExit;
use App\Models\ExitDocument;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Recipients;
use App\Support\TenantCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ExitService
{
    private const DISK = 'local';

    public function __construct(
        private readonly NotificationService $notifications,
        private readonly ClearanceService $clearance
    ) {}

    /* ----------------------------------------------------------- resignation */

    public function apply(User $actor, array $data): EmployeeExit
    {
        $employee = $this->employeeFor($actor, isset($data['employee_id']) ? (int) $data['employee_id'] : null);

        $this->assertNoOpenExit($employee);

        $resignationDate = isset($data['resignation_date'])
            ? Carbon::parse($data['resignation_date'])->startOfDay()
            : Carbon::today();

        $this->assertResignationDate($resignationDate);

        $noticeDays = $this->noticeDaysFor($employee);
        $requested = isset($data['requested_last_working_date'])
            ? Carbon::parse($data['requested_last_working_date'])->startOfDay()
            : null;

        if ($requested !== null && $requested->lessThan($resignationDate)) {
            throw new ApiException(
                'Last working date resignation date se pehle nahi ho sakti.',
                422,
                'EXIT_DATE_INVALID'
            );
        }

        $exit = DB::transaction(function () use ($employee, $data, $resignationDate, $requested, $noticeDays, $actor): EmployeeExit {
            $exit = new EmployeeExit([
                'exit_type' => $data['exit_type'] ?? EmployeeExit::TYPE_RESIGNATION,
                'resignation_date' => $resignationDate->toDateString(),
                'requested_last_working_date' => $requested?->toDateString(),
                'reason' => $data['reason'],
            ]);

            $exit->company_id = $employee->company_id;
            $exit->employee_id = $employee->id;
            $exit->notice_period_days = $noticeDays;
            $exit->applied_by = $actor->id;
            $exit->created_by = $actor->id;
            $exit->save();

            $this->flush();

            return $exit->refresh()->load('employee.user');
        });

        $this->notifyManager($exit, $actor);

        return $exit;
    }

    public function withdraw(EmployeeExit $exit, User $actor): EmployeeExit
    {
        $this->assertOwner($exit, $actor);

        if ($exit->isClosed()) {
            throw new ApiException('Ye resignation already ' . $exit->stageLabel() . '.', 409, 'EXIT_ALREADY_CLOSED');
        }

        if ($exit->isServingNotice()) {
            throw new ApiException(
                'HR final approval de chuki hai. Ab withdraw HR hi kar sakti hai.',
                409,
                'EXIT_WITHDRAW_LOCKED'
            );
        }

        $exit->forceFill([
            'status' => EmployeeExit::WITHDRAWN,
            'withdrawn_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $exit = $exit->refresh()->load('employee.user');

        $this->notifyWithdrawn($exit, $actor);

        return $exit;
    }

    /* -------------------------------------------------------- manager stage */

    public function managerApprove(EmployeeExit $exit, array $data, User $actor): EmployeeExit
    {
        $this->assertCanApproveAsManager($exit, $actor);

        if (! $exit->isPending()) {
            throw new ApiException(
                'Ye resignation ab manager stage par nahi hai — abhi ' . $exit->stageLabel() . '.',
                409,
                'EXIT_WRONG_STAGE'
            );
        }

        $exit->forceFill([
            'status' => EmployeeExit::MANAGER_APPROVED,
            'manager_id' => $actor->id,
            'manager_decided_at' => Carbon::now(),
            'manager_remarks' => $data['remarks'] ?? null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $exit = $exit->refresh()->load('employee.user', 'manager');

        $this->notifyEmployee($exit, $actor, NotificationType::EXIT_MANAGER_APPROVED,
            'Manager ne resignation approve kar di',
            'Ab HR final approval degi aur last working date set karegi.');
        $this->notifyHr($exit, $actor);

        return $exit;
    }

    /* ------------------------------------------------------------- HR stage */

    public function hrApprove(EmployeeExit $exit, array $data, User $actor): EmployeeExit
    {
        $this->assertPermission($actor, EmployeeExit::APPROVE_PERMISSION, 'final approval dene');

        if (! $exit->isManagerApproved()) {
            throw new ApiException(
                $exit->isPending()
                    ? 'Pehle manager approve karega, tab HR final approval degi.'
                    : 'Ye resignation ab HR stage par nahi hai — abhi ' . $exit->stageLabel() . '.',
                409,
                'EXIT_WRONG_STAGE'
            );
        }

        $lastWorkingDate = isset($data['last_working_date'])
            ? Carbon::parse($data['last_working_date'])->startOfDay()
            : $this->defaultLastWorkingDate($exit);

        $this->assertLastWorkingDate($exit, $lastWorkingDate);

        $exit = DB::transaction(function () use ($exit, $lastWorkingDate, $data, $actor): EmployeeExit {
            $exit->forceFill([
                'status' => EmployeeExit::SERVING_NOTICE,
                'last_working_date' => $lastWorkingDate->toDateString(),
                'hr_id' => $actor->id,
                'hr_decided_at' => Carbon::now(),
                'hr_remarks' => $data['remarks'] ?? null,
                'updated_by' => $actor->id,
            ])->save();

            $exit->employee->forceFill([
                'employment_status' => Employee::EMPLOYMENT_SERVING_NOTICE,
                'exit_date' => $lastWorkingDate->toDateString(),
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();

            return $exit->refresh()->load('employee.user', 'manager', 'hr');
        });

        $this->clearance->generateFor($exit, $actor);

        $this->notifyEmployee($exit, $actor, NotificationType::EXIT_APPROVED,
            'Resignation final approve ho gayi',
            'Last working day ' . $lastWorkingDate->format('d M Y') . '. Us din ke baad login band ho jayega.');
        $this->notifyManagerOfDecision($exit, $actor);

        return $exit->refresh()->load('employee.user', 'manager', 'hr');
    }

    public function changeLastWorkingDate(EmployeeExit $exit, array $data, User $actor): EmployeeExit
    {
        $this->assertPermission($actor, EmployeeExit::APPROVE_PERMISSION, 'last working date badalne');

        if (! $exit->isServingNotice()) {
            throw new ApiException(
                'Sirf notice period ke dauraan hi date badal sakti hai — abhi ' . $exit->stageLabel() . '.',
                409,
                'EXIT_WRONG_STAGE'
            );
        }

        $lastWorkingDate = Carbon::parse($data['last_working_date'])->startOfDay();
        $this->assertLastWorkingDate($exit, $lastWorkingDate);

        $previous = $exit->last_working_date;

        $exit = DB::transaction(function () use ($exit, $lastWorkingDate, $data, $actor): EmployeeExit {
            $exit->forceFill([
                'last_working_date' => $lastWorkingDate->toDateString(),
                'hr_remarks' => $data['remarks'] ?? $exit->hr_remarks,
                'updated_by' => $actor->id,
            ])->save();

            $exit->employee->forceFill([
                'exit_date' => $lastWorkingDate->toDateString(),
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();

            return $exit->refresh()->load('employee.user', 'manager', 'hr');
        });

        $this->notifyEmployee($exit, $actor, NotificationType::EXIT_DATE_CHANGED,
            'Last working date badal gayi',
            'Pehle ' . $previous?->format('d M Y') . ' thi, ab ' . $lastWorkingDate->format('d M Y') . ' hai.');

        return $exit;
    }

    public function reject(EmployeeExit $exit, array $data, User $actor): EmployeeExit
    {
        if ($exit->isClosed()) {
            throw new ApiException('Ye resignation already ' . $exit->stageLabel() . '.', 409, 'EXIT_ALREADY_CLOSED');
        }

        $stage = $exit->isPending() ? EmployeeExit::STAGE_MANAGER : EmployeeExit::STAGE_HR;

        if ($stage === EmployeeExit::STAGE_MANAGER) {
            $this->assertCanApproveAsManager($exit, $actor);
        } else {
            $this->assertPermission($actor, EmployeeExit::APPROVE_PERMISSION, 'reject karne');
        }

        $exit = DB::transaction(function () use ($exit, $data, $stage, $actor): EmployeeExit {
            $exit->forceFill([
                'status' => EmployeeExit::REJECTED,
                'rejected_by' => $actor->id,
                'rejected_at' => Carbon::now(),
                'reject_reason' => $data['reason'],
                'rejected_stage' => $stage,
                'updated_by' => $actor->id,
            ])->save();

            $exit->employee->forceFill([
                'employment_status' => Employee::EMPLOYMENT_ACTIVE,
                'exit_date' => null,
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();

            return $exit->refresh()->load('employee.user');
        });

        $this->notifyEmployee($exit, $actor, NotificationType::EXIT_REJECTED,
            'Resignation reject ho gayi',
            $data['reason']);

        return $exit;
    }

    /* ---------------------------------------------------------------- exit */

    public function complete(EmployeeExit $exit, array $data, User $actor): EmployeeExit
    {
        $this->assertPermission($actor, EmployeeExit::APPROVE_PERMISSION, 'exit complete karne');

        if (! $exit->isServingNotice()) {
            throw new ApiException(
                'Sirf notice period wali resignation hi complete hoti hai — abhi ' . $exit->stageLabel() . '.',
                409,
                'EXIT_WRONG_STAGE'
            );
        }

        $this->clearance->assertComplete($exit, $data, $actor);

        return $this->finalise($exit, $actor);
    }

    /**
     * Login band, employment_status exited. Scheduled command aur manual complete
     * dono yahi se guzarte hain.
     */
    public function finalise(EmployeeExit $exit, ?User $actor = null): EmployeeExit
    {
        $exit = DB::transaction(function () use ($exit, $actor): EmployeeExit {
            $exit->forceFill([
                'status' => EmployeeExit::EXITED,
                'exited_at' => Carbon::now(),
                'updated_by' => $actor?->id,
            ])->save();

            $employee = $exit->employee;

            $employee->forceFill([
                'employment_status' => Employee::EMPLOYMENT_EXITED,
                'exit_date' => $exit->last_working_date?->toDateString(),
                'updated_by' => $actor?->id,
            ])->save();

            $user = User::query()->whereKey($employee->user_id)->first();

            if ($user !== null) {
                $user->forceFill(['status' => 'inactive', 'updated_by' => $actor?->id])->save();
                $user->revokeTokens();
            }

            $this->flush();

            return $exit->refresh()->load('employee.user', 'manager', 'hr');
        });

        $this->notifyExitDone($exit);

        return $exit;
    }

    /* ------------------------------------------------------------ documents */

    public function addDocument(EmployeeExit $exit, array $data, UploadedFile $file, User $actor): ExitDocument
    {
        $this->assertPermission($actor, EmployeeExit::DOCUMENT_PERMISSION, 'exit documents dene');

        if (! $exit->isServingNotice() && ! $exit->isExited()) {
            throw new ApiException(
                'Final approval ke baad hi letter issue hote hain — abhi ' . $exit->stageLabel() . '.',
                409,
                'EXIT_WRONG_STAGE'
            );
        }

        if ($data['type'] === ExitDocument::RELIEVING_LETTER) {
            $this->clearance->assertCanIssueRelieving($exit);
        }

        return DB::transaction(function () use ($exit, $data, $file, $actor): ExitDocument {
            $path = $file->storeAs(
                'exits/' . $exit->company_id . '/' . $exit->id,
                Str::uuid()->toString() . '.' . strtolower($file->getClientOriginalExtension() ?: 'bin'),
                self::DISK
            );

            $document = new ExitDocument([
                'type' => $data['type'],
                'file_path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size_bytes' => $file->getSize() ?: 0,
                'issued_on' => $data['issued_on'] ?? Carbon::today()->toDateString(),
                'remarks' => $data['remarks'] ?? null,
            ]);

            $document->company_id = $exit->company_id;
            $document->employee_exit_id = $exit->id;
            $document->uploaded_by = $actor->id;
            $document->created_by = $actor->id;
            $document->save();

            $this->flush();
            $this->notifyDocument($exit, $document, $actor);

            return $document->refresh()->load('uploader');
        });
    }

    public function deleteDocument(ExitDocument $document, User $actor): void
    {
        $this->assertPermission($actor, EmployeeExit::DOCUMENT_PERMISSION, 'exit documents hataane');

        DB::transaction(function () use ($document): void {
            if (Storage::disk(self::DISK)->exists($document->file_path)) {
                Storage::disk(self::DISK)->delete($document->file_path);
            }

            $document->deactivate();
            $this->flush();
        });
    }

    public function downloadDocument(ExitDocument $document): StreamedResponse
    {
        if (! Storage::disk(self::DISK)->exists($document->file_path)) {
            throw new ApiException('Ye document ab available nahi hai.', 404, 'FILE_MISSING');
        }

        return Storage::disk(self::DISK)->download($document->file_path, $document->original_name);
    }

    /* -------------------------------------------------------------- summary */

    public function summary(User $actor): array
    {
        $this->assertPermission($actor, EmployeeExit::APPROVE_PERMISSION, 'exit summary dekhne');

        $counts = DB::table('employee_exits')
            ->where('company_id', $actor->company_id)
            ->where('is_active', 1)
            ->selectRaw("
                COUNT(*) as total,
                SUM(status = 'pending') as pending_manager,
                SUM(status = 'manager_approved') as pending_hr,
                SUM(status = 'serving_notice') as serving_notice,
                SUM(status = 'exited') as exited,
                SUM(status = 'rejected') as rejected,
                SUM(status = 'withdrawn') as withdrawn
            ")
            ->first();

        $upcoming = DB::table('employee_exits as x')
            ->join('employees as e', 'e.id', '=', 'x.employee_id')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->where('x.company_id', $actor->company_id)
            ->where('x.is_active', 1)
            ->where('x.status', EmployeeExit::SERVING_NOTICE)
            ->orderBy('x.last_working_date')
            ->get([
                'x.uuid',
                'x.last_working_date',
                'e.employee_code',
                'u.name as employee_name',
            ])
            ->map(fn ($row): array => [
                'uuid' => $row->uuid,
                'employee_code' => $row->employee_code,
                'employee_name' => $row->employee_name,
                'last_working_date' => $row->last_working_date,
                'days_left' => (int) Carbon::today()->diffInDays(Carbon::parse($row->last_working_date), false),
            ])
            ->all();

        return [
            'counts' => [
                'total' => (int) $counts->total,
                'pending_manager' => (int) $counts->pending_manager,
                'pending_hr' => (int) $counts->pending_hr,
                'serving_notice' => (int) $counts->serving_notice,
                'exited' => (int) $counts->exited,
                'rejected' => (int) $counts->rejected,
                'withdrawn' => (int) $counts->withdrawn,
            ],
            'notice_period_days' => (int) DB::table('companies')
                ->where('id', $actor->company_id)
                ->value('notice_period_days'),
            'upcoming_exits' => $upcoming,
        ];
    }

    /* --------------------------------------------------------------- guards */

    public function noticeDaysFor(Employee $employee): int
    {
        $days = DB::table('companies')->where('id', $employee->company_id)->value('notice_period_days');

        return $days === null ? EmployeeExit::DEFAULT_NOTICE_DAYS : (int) $days;
    }

    private function defaultLastWorkingDate(EmployeeExit $exit): Carbon
    {
        return $exit->resignation_date->copy()->addDays($exit->notice_period_days);
    }

    private function assertResignationDate(Carbon $date): void
    {
        if ($date->greaterThan(Carbon::today())) {
            throw new ApiException('Resignation date aane wale din ki nahi ho sakti.', 422, 'EXIT_DATE_INVALID');
        }
    }

    private function assertLastWorkingDate(EmployeeExit $exit, Carbon $date): void
    {
        if ($date->lessThan($exit->resignation_date)) {
            throw new ApiException(
                'Last working date resignation date (' . $exit->resignation_date->format('d M Y') . ') se pehle nahi ho sakti.',
                422,
                'EXIT_DATE_INVALID'
            );
        }

        if ($date->lessThan($exit->employee->date_of_joining)) {
            throw new ApiException(
                'Last working date joining date se pehle nahi ho sakti.',
                422,
                'EXIT_DATE_INVALID'
            );
        }
    }

    private function assertNoOpenExit(Employee $employee): void
    {
        if ($employee->isExited()) {
            throw new ApiException('Ye employee already exit ho chuka hai.', 409, 'EXIT_ALREADY_DONE');
        }

        $open = EmployeeExit::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', [
                EmployeeExit::PENDING,
                EmployeeExit::MANAGER_APPROVED,
                EmployeeExit::SERVING_NOTICE,
            ])
            ->exists();

        if ($open) {
            throw new ApiException(
                'Iski ek resignation already chal rahi hai. Pehle wo close karo.',
                409,
                'EXIT_ALREADY_OPEN'
            );
        }
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        if ($employeeId === null) {
            $employee = Employee::query()->with('user')->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Resignation dene ke liye employee record chahiye. HR se baat karo.',
                    422,
                    'EMPLOYEE_RECORD_MISSING'
                );
            }

            return $employee;
        }

        if (! $actor->isSuperAdmin() && ! $actor->hasPermission(EmployeeExit::APPROVE_PERMISSION)) {
            throw new ApiException('Kisi aur ki resignation daalne ki permission nahi hai.', 403, 'FORBIDDEN');
        }

        $employee = Employee::query()->with('user')->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }

    private function assertOwner(EmployeeExit $exit, User $actor): void
    {
        if ((int) $exit->employee->user_id === (int) $actor->id || $actor->isSuperAdmin()) {
            return;
        }

        throw new ApiException('Ye resignation aapki nahi hai.', 403, 'FORBIDDEN');
    }

    private function assertCanApproveAsManager(EmployeeExit $exit, User $actor): void
    {
        if ((int) $exit->employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Apni resignation khud approve nahi kar sakte.', 403, 'EXIT_SELF_APPROVAL');
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(EmployeeExit::APPROVE_PERMISSION)) {
            return;
        }

        if ((int) $exit->employee->reporting_manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Aap is resignation par decision nahi le sakte.', 403, 'FORBIDDEN');
    }

    private function assertPermission(User $actor, string $permission, string $what): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission($permission)) {
            return;
        }

        throw new ApiException('Aapke paas ' . $what . ' ka haq nahi hai.', 403, 'FORBIDDEN');
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::EXITS, TenantCache::EMPLOYEES, TenantCache::USERS);
    }

    /* -------------------------------------------------------- notifications */

    private function notifyManager(EmployeeExit $exit, User $actor): void
    {
        $this->notifications->sendMany(
            Recipients::approversFor($exit->employee, EmployeeExit::APPROVE_PERMISSION),
            [
                'type' => NotificationType::EXIT_APPLIED,
                'title' => $this->employeeName($exit) . ' ne resignation daali hai',
                'body' => $exit->typeLabel() . ' · ' . $exit->resignation_date->format('d M Y')
                    . ' · notice ' . $exit->notice_period_days . ' din',
                'action_url' => '/exits/' . $exit->uuid,
                'entity_type' => 'employee_exit',
                'entity_id' => $exit->id,
                'payload' => $this->payload($exit),
                'dedupe_key' => 'exit:' . $exit->id . ':applied',
            ],
            $actor
        );
    }

    private function notifyHr(EmployeeExit $exit, User $actor): void
    {
        $recipients = Recipients::except(
            Recipients::withPermission((int) $exit->company_id, EmployeeExit::APPROVE_PERMISSION),
            [(int) $exit->employee->user_id, (int) $actor->id]
        );

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::EXIT_HR_PENDING,
            'title' => $this->employeeName($exit) . ' ka exit final approval chahiye',
            'body' => 'Manager approve kar chuka hai. Last working date set karni hai.',
            'action_url' => '/exits/' . $exit->uuid,
            'entity_type' => 'employee_exit',
            'entity_id' => $exit->id,
            'payload' => $this->payload($exit),
            'dedupe_key' => 'exit:' . $exit->id . ':hr',
        ], $actor);
    }

    private function notifyEmployee(EmployeeExit $exit, ?User $actor, string $type, string $title, string $body): void
    {
        $userId = (int) ($exit->employee->user_id ?? 0);

        if ($userId === 0 || ($actor !== null && $userId === (int) $actor->id)) {
            return;
        }

        $this->notifications->send($userId, [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => '/exits/' . $exit->uuid,
            'entity_type' => 'employee_exit',
            'entity_id' => $exit->id,
            'payload' => $this->payload($exit),
            'dedupe_key' => 'exit:' . $exit->id . ':' . $type,
        ]);
    }

    private function notifyManagerOfDecision(EmployeeExit $exit, User $actor): void
    {
        $managerId = (int) ($exit->employee->reporting_manager_id ?? 0);

        if ($managerId === 0 || $managerId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($managerId, [
            'type' => NotificationType::EXIT_APPROVED,
            'title' => $this->employeeName($exit) . ' ka exit confirm ho gaya',
            'body' => 'Last working day ' . $exit->last_working_date?->format('d M Y') . '. Handover plan kar lo.',
            'action_url' => '/exits/' . $exit->uuid,
            'entity_type' => 'employee_exit',
            'entity_id' => $exit->id,
            'payload' => $this->payload($exit),
            'dedupe_key' => 'exit:' . $exit->id . ':manager-informed',
        ]);
    }

    private function notifyWithdrawn(EmployeeExit $exit, User $actor): void
    {
        $recipients = Recipients::except(
            array_merge(
                Recipients::withPermission((int) $exit->company_id, EmployeeExit::APPROVE_PERMISSION),
                [(int) ($exit->employee->reporting_manager_id ?? 0)]
            ),
            [(int) $actor->id]
        );

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::EXIT_WITHDRAWN,
            'title' => $this->employeeName($exit) . ' ne resignation wapas le li',
            'body' => 'Ab koi action nahi chahiye.',
            'action_url' => '/exits/' . $exit->uuid,
            'entity_type' => 'employee_exit',
            'entity_id' => $exit->id,
            'payload' => $this->payload($exit),
            'dedupe_key' => 'exit:' . $exit->id . ':withdrawn',
        ], $actor);
    }

    private function notifyExitDone(EmployeeExit $exit): void
    {
        $recipients = Recipients::except(
            array_merge(
                Recipients::withPermission((int) $exit->company_id, EmployeeExit::APPROVE_PERMISSION),
                [(int) ($exit->employee->reporting_manager_id ?? 0)]
            ),
            [(int) $exit->employee->user_id]
        );

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::EXIT_COMPLETED,
            'title' => $this->employeeName($exit) . ' exit ho gaya',
            'body' => 'Login band kar diya gaya. Record history mein rahega.',
            'action_url' => '/exits/' . $exit->uuid,
            'entity_type' => 'employee_exit',
            'entity_id' => $exit->id,
            'payload' => $this->payload($exit),
            'dedupe_key' => 'exit:' . $exit->id . ':completed',
        ]);
    }

    private function notifyDocument(EmployeeExit $exit, ExitDocument $document, User $actor): void
    {
        $this->notifyEmployee(
            $exit,
            $actor,
            NotificationType::EXIT_DOCUMENT_ISSUED,
            $document->typeLabel() . ' issue ho gaya',
            'HR ne ' . $document->typeLabel() . ' upload kar diya hai.'
        );
    }

    private function employeeName(EmployeeExit $exit): string
    {
        return $exit->employee->user?->name ?? $exit->employee->employee_code;
    }

    private function payload(EmployeeExit $exit): array
    {
        return [
            'exit_id' => $exit->id,
            'employee_id' => $exit->employee_id,
            'status' => $exit->status,
            'exit_type' => $exit->exit_type,
            'resignation_date' => $exit->resignation_date?->toDateString(),
            'last_working_date' => $exit->last_working_date?->toDateString(),
            'notice_period_days' => $exit->notice_period_days,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\LeaveRequest;
use App\Models\LeaveRequestDay;
use App\Models\LeaveType;
use App\Models\User;
use App\Support\LeaveCalendar;
use App\Support\NotificationType;
use App\Support\Realtime;
use App\Support\Recipients;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use App\Support\WorkCalendar;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class LeaveRequestService
{
    public const APPROVE_PERMISSION = 'leave.approve';

    public function __construct(
        private readonly LeaveBalanceService $balances,
        private readonly AttendanceService $attendance,
        private readonly NotificationService $notifications
    ) {}

    public function apply(User $actor, array $data): LeaveRequest
    {
        $employee = $this->employeeFor($actor, isset($data['employee_id']) ? (int) $data['employee_id'] : null);
        $type = $this->leaveType((int) $data['leave_type_id']);

        $from = Carbon::parse($data['from_date'])->startOfDay();
        $to = Carbon::parse($data['to_date'])->startOfDay();
        $halfDay = (bool) ($data['is_half_day'] ?? false);
        $session = $data['half_day_session'] ?? null;

        $this->assertEligible($employee, $type, $from, $halfDay, $to);

        $plan = LeaveCalendar::plan($employee, $from, $to, $type, $halfDay, $session);

        if ($plan['days'] === []) {
            throw new ApiException(
                'In dates par koi working day nahi hai — sab holiday ya weekly off hain.',
                422,
                'LEAVE_NO_WORKING_DAY'
            );
        }

        $this->assertWithinStreak($type, $plan['count']);
        $this->assertNoOverlap($employee, array_column($plan['days'], 'date'));

        $request = DB::transaction(function () use ($employee, $type, $from, $to, $halfDay, $session, $plan, $data, $actor): LeaveRequest {
            if ($type->tracksBalance()) {
                $this->assertBalance($employee, $type, $from, $plan['count'], $actor);
            }

            $request = new LeaveRequest([
                'from_date' => $from->toDateString(),
                'to_date' => $to->toDateString(),
                'is_half_day' => $halfDay,
                'half_day_session' => $halfDay ? $session : null,
                'reason' => $data['reason'],
                'contact_number' => $data['contact_number'] ?? null,
                'document_id' => $this->documentId($employee, $data, $type),
            ]);

            $request->company_id = $employee->company_id;
            $request->employee_id = $employee->id;
            $request->leave_type_id = $type->id;
            $request->day_count = $plan['count'];
            $request->applied_by = $actor->id;
            $request->created_by = $actor->id;
            $request->save();

            foreach ($plan['days'] as $day) {
                $row = new LeaveRequestDay([
                    'leave_date' => $day['date'],
                    'day_portion' => $day['portion'],
                    'session' => $day['session'],
                    'status' => LeaveRequest::PENDING,
                ]);
                $row->company_id = $employee->company_id;
                $row->leave_request_id = $request->id;
                $row->employee_id = $employee->id;
                $row->save();
            }

            $this->flush();

            return $request->refresh()->load('leaveType', 'days', 'employee.user');
        });

        $this->notifyApplied($request, $actor);

        return $request;
    }

    public function approve(LeaveRequest $request, array $data, User $actor): LeaveRequest
    {
        $this->assertCanDecide($request, $actor);
        $this->assertPending($request);

        $request = DB::transaction(function () use ($request, $data, $actor): LeaveRequest {
            $type = $request->leaveType;

            if ($type !== null && $type->tracksBalance()) {
                $balance = $this->balances->ensureBalance(
                    $request->employee,
                    $type,
                    (int) $request->from_date->format('Y'),
                    $actor
                );

                if ($balance->available < $request->day_count) {
                    throw new ApiException(
                        'Balance kam pad gaya. Available: ' . $balance->available . ' din, maanga: ' . $request->day_count . ' din.',
                        422,
                        'LEAVE_BALANCE_SHORT'
                    );
                }

                $balance->forceFill([
                    'used' => round($balance->used + $request->day_count, 2),
                    'updated_by' => $actor->id,
                ])->save();
            }

            $request->forceFill([
                'status' => LeaveRequest::APPROVED,
                'approver_id' => $actor->id,
                'decided_at' => Carbon::now(),
                'decision_remarks' => $data['remarks'] ?? null,
                'updated_by' => $actor->id,
            ])->save();

            $request->days()->update(['status' => LeaveRequest::APPROVED, 'updated_at' => Carbon::now()]);

            WorkCalendar::forgetLeave($request->employee_id);
            $this->syncAttendance($request, $actor);
            $this->flush();

            return $request->refresh()->load('leaveType', 'days', 'employee.user', 'approver');
        });

        $this->notifyDecision($request, $actor, NotificationType::LEAVE_APPROVED);

        return $request;
    }

    public function reject(LeaveRequest $request, array $data, User $actor): LeaveRequest
    {
        $this->assertCanDecide($request, $actor);
        $this->assertPending($request);

        $request = DB::transaction(function () use ($request, $data, $actor): LeaveRequest {
            $request->forceFill([
                'status' => LeaveRequest::REJECTED,
                'approver_id' => $actor->id,
                'decided_at' => Carbon::now(),
                'decision_remarks' => $data['remarks'],
                'updated_by' => $actor->id,
            ])->save();

            $request->days()->update(['status' => LeaveRequest::REJECTED, 'updated_at' => Carbon::now()]);

            WorkCalendar::forgetLeave($request->employee_id);
            $this->flush();

            return $request->refresh()->load('leaveType', 'days', 'employee.user', 'approver');
        });

        $this->notifyDecision($request, $actor, NotificationType::LEAVE_REJECTED);

        return $request;
    }

    public function cancel(LeaveRequest $request, User $actor): LeaveRequest
    {
        $this->assertCanCancel($request, $actor);

        $request = DB::transaction(function () use ($request, $actor): LeaveRequest {
            $wasApproved = $request->isApproved();

            if ($wasApproved) {
                $this->refund($request, $actor);
            }

            $request->forceFill([
                'status' => LeaveRequest::CANCELLED,
                'cancelled_at' => Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $request->days()->update(['status' => LeaveRequest::CANCELLED, 'updated_at' => Carbon::now()]);

            WorkCalendar::forgetLeave($request->employee_id);

            if ($wasApproved) {
                $this->clearAttendance($request, $actor);
            }

            $this->flush();

            return $request->refresh()->load('leaveType', 'days', 'employee.user');
        });

        $this->notifyCancelled($request, $actor);

        return $request;
    }

    public function myBalances(User $actor, int $year): Collection
    {
        $employee = $this->employeeFor($actor, null);

        $types = LeaveType::query()->where('status', 'active')->orderBy('sort_order')->get();

        return $types->map(function (LeaveType $type) use ($employee, $year): array {
            $balance = $this->balances->balanceFor($employee, $type, $year);
            $pending = $this->balances->pendingDays($employee, $type, $year);

            return [
                'leave_type_id' => $type->id,
                'code' => $type->code,
                'name' => $type->name,
                'is_paid' => $type->is_paid,
                'annual_quota' => $type->annual_quota,
                'tracks_balance' => $type->tracksBalance(),
                'opening' => (float) ($balance->opening ?? 0),
                'accrued' => (float) ($balance->accrued ?? 0),
                'used' => (float) ($balance->used ?? 0),
                'encashed' => (float) ($balance->encashed ?? 0),
                'adjusted' => (float) ($balance->adjusted ?? 0),
                'available' => (float) ($balance->available ?? 0),
                'pending_approval' => $pending,
                'usable' => round((float) ($balance->available ?? 0) - $pending, 2),
            ];
        });
    }

    public function calendar(User $actor, string $month): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $employeeIds = Employee::query()->visibleTo($actor)->pluck('id');

        $rows = DB::table('leave_request_days as d')
            ->join('leave_requests as r', 'r.id', '=', 'd.leave_request_id')
            ->join('employees as e', 'e.id', '=', 'd.employee_id')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->join('leave_types as t', 't.id', '=', 'r.leave_type_id')
            ->whereIn('d.employee_id', $employeeIds)
            ->whereIn('d.status', [LeaveRequest::PENDING, LeaveRequest::APPROVED])
            ->whereBetween('d.leave_date', [$start->toDateString(), $end->toDateString()])
            ->whereNull('r.deleted_at')
            ->orderBy('d.leave_date')
            ->orderBy('u.name')
            ->get([
                'd.leave_date',
                'd.day_portion',
                'd.session',
                'd.status',
                'r.id as leave_request_id',
                'e.id as employee_id',
                'e.employee_code',
                'u.name as employee_name',
                't.code as leave_code',
                't.name as leave_name',
            ]);

        $byDate = [];

        foreach ($rows as $row) {
            $byDate[$row->leave_date][] = [
                'leave_request_id' => (int) $row->leave_request_id,
                'employee_id' => (int) $row->employee_id,
                'employee_code' => $row->employee_code,
                'employee_name' => $row->employee_name,
                'leave_code' => $row->leave_code,
                'leave_name' => $row->leave_name,
                'day_portion' => (float) $row->day_portion,
                'session' => $row->session,
                'status' => $row->status,
            ];
        }

        $days = [];

        for ($date = $start->copy(); $date->lessThanOrEqualTo($end); $date->addDay()) {
            $key = $date->toDateString();

            $days[] = [
                'date' => $key,
                'weekday' => $date->format('l'),
                'on_leave_count' => count($byDate[$key] ?? []),
                'employees' => $byDate[$key] ?? [],
            ];
        }

        return [
            'month' => $start->format('Y-m'),
            'total_leave_days' => $rows->count(),
            'days' => $days,
        ];
    }

    private function notifyApplied(LeaveRequest $request, User $actor): void
    {
        $employee = $request->employee;
        $approvers = Recipients::approversFor($employee, self::APPROVE_PERMISSION);
        $name = $employee->user?->name ?? $employee->employee_code;

        $this->notifications->sendMany($approvers, [
            'type' => NotificationType::LEAVE_APPLIED,
            'title' => $name . ' ne leave apply ki hai',
            'body' => $this->summary($request) . ' — approval ka intezaar hai.',
            'action_url' => '/leaves/' . $request->uuid,
            'entity_type' => 'leave_request',
            'entity_id' => $request->id,
            'payload' => $this->payload($request),
            'dedupe_key' => 'leave:' . $request->id,
        ], $actor);

        $this->broadcastChange($request, LeaveRequest::PENDING, $approvers);
    }

    private function notifyDecision(LeaveRequest $request, User $actor, string $type): void
    {
        $approved = $type === NotificationType::LEAVE_APPROVED;
        $remarks = $request->decision_remarks;

        $this->notifications->send((int) $request->employee->user_id, [
            'type' => $type,
            'title' => 'Aapki leave ' . ($approved ? 'approve' : 'reject') . ' ho gayi',
            'body' => $this->summary($request) . ($remarks === null ? '' : ' — ' . $remarks),
            'action_url' => '/leaves/' . $request->uuid,
            'entity_type' => 'leave_request',
            'entity_id' => $request->id,
            'payload' => $this->payload($request),
        ], $actor);

        $this->broadcastChange($request, $request->status, Recipients::approversFor($request->employee, self::APPROVE_PERMISSION));
    }

    private function notifyCancelled(LeaveRequest $request, User $actor): void
    {
        $employee = $request->employee;
        $isOwner = (int) $employee->user_id === (int) $actor->id;
        $name = $employee->user?->name ?? $employee->employee_code;

        $recipients = $isOwner
            ? Recipients::approversFor($employee, self::APPROVE_PERMISSION)
            : [(int) $employee->user_id];

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::LEAVE_CANCELLED,
            'title' => $isOwner ? $name . ' ne leave cancel kar di' : 'Aapki leave cancel kar di gayi',
            'body' => $this->summary($request),
            'action_url' => '/leaves/' . $request->uuid,
            'entity_type' => 'leave_request',
            'entity_id' => $request->id,
            'payload' => $this->payload($request),
        ], $actor);

        $this->broadcastChange($request, LeaveRequest::CANCELLED, $recipients);
    }

    private function broadcastChange(LeaveRequest $request, string $status, array $watchers): void
    {
        Realtime::toUsers(
            array_merge($watchers, [(int) $request->employee->user_id]),
            'leave.changed',
            ['status' => $status] + $this->payload($request)
        );
    }

    private function payload(LeaveRequest $request): array
    {
        return [
            'leave_request_id' => (int) $request->id,
            'leave_request_uuid' => $request->uuid,
            'employee_id' => (int) $request->employee_id,
            'employee_name' => $request->employee->user?->name,
            'leave_type' => $request->leaveType?->name,
            'leave_code' => $request->leaveType?->code,
            'from_date' => $request->from_date->toDateString(),
            'to_date' => $request->to_date->toDateString(),
            'day_count' => (float) $request->day_count,
            'status' => $request->status,
        ];
    }

    private function summary(LeaveRequest $request): string
    {
        $type = $request->leaveType?->name ?? 'Leave';
        $days = $request->day_count == 1 ? '1 din' : $request->day_count . ' din';

        if ($request->from_date->isSameDay($request->to_date)) {
            return $type . ' — ' . $request->from_date->format('d M Y') . ' (' . $days . ')';
        }

        return $type . ' — ' . $request->from_date->format('d M') . ' se '
            . $request->to_date->format('d M Y') . ' (' . $days . ')';
    }

    private function syncAttendance(LeaveRequest $request, User $actor): void
    {
        foreach ($request->days as $day) {
            $this->attendance->setLeavePortion(
                $request->employee,
                $day->leave_date->toDateString(),
                (float) $day->day_portion,
                $actor
            );
        }
    }

    private function clearAttendance(LeaveRequest $request, User $actor): void
    {
        foreach ($request->days as $day) {
            $this->attendance->setLeavePortion(
                $request->employee,
                $day->leave_date->toDateString(),
                0.0,
                $actor
            );
        }
    }

    private function refund(LeaveRequest $request, User $actor): void
    {
        $type = $request->leaveType;

        if ($type === null || ! $type->tracksBalance()) {
            return;
        }

        $balance = $this->balances->balanceFor(
            $request->employee,
            $type,
            (int) $request->from_date->format('Y'),
            true
        );

        if ($balance === null) {
            return;
        }

        $balance->forceFill([
            'used' => max(0, round($balance->used - $request->day_count, 2)),
            'updated_by' => $actor->id,
        ])->save();
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        if ($employeeId === null) {
            $employee = Employee::query()->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Leave ke liye employee record chahiye. HR se onboarding karwao.',
                    422,
                    'EMPLOYEE_RECORD_MISSING'
                );
            }

            return $employee;
        }

        if (! $actor->isSuperAdmin() && ! $actor->hasPermission(self::APPROVE_PERMISSION)) {
            throw new ApiException(
                'Kisi aur ki leave apply karne ki permission nahi hai.',
                403,
                'FORBIDDEN'
            );
        }

        $employee = Employee::query()->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }

    private function leaveType(int $id): LeaveType
    {
        $type = LeaveType::query()->whereKey($id)->first();

        if ($type === null) {
            throw new ApiException('Leave type not found.', 404, 'NOT_FOUND');
        }

        if (! $type->isActive()) {
            throw new ApiException('Ye leave type abhi inactive hai.', 422, 'LEAVE_TYPE_INACTIVE');
        }

        return $type;
    }

    private function assertEligible(Employee $employee, LeaveType $type, Carbon $from, bool $halfDay, Carbon $to): void
    {
        if ($from->greaterThan($to)) {
            throw new ApiException('From date, to date se aage nahi ho sakti.', 422, 'LEAVE_DATE_INVALID');
        }

        if ($halfDay && ! $from->isSameDay($to)) {
            throw new ApiException('Half day sirf ek din ke liye lagti hai.', 422, 'LEAVE_HALF_DAY_RANGE');
        }

        if ($halfDay && ! $type->allow_half_day) {
            throw new ApiException($type->name . ' mein half day allowed nahi hai.', 422, 'LEAVE_HALF_DAY_BLOCKED');
        }

        if (! $type->allowsGender($employee->gender)) {
            throw new ApiException(
                $type->name . ' sirf ' . $type->applicable_to . ' employees ke liye hai.',
                422,
                'LEAVE_GENDER_MISMATCH'
            );
        }

        if ($type->min_service_months > 0) {
            $eligibleFrom = $employee->date_of_joining?->copy()->addMonths($type->min_service_months);

            if ($eligibleFrom !== null && $from->lessThan($eligibleFrom)) {
                throw new ApiException(
                    $type->name . ' ' . $eligibleFrom->format('d M Y') . ' ke baad hi le sakte ho.',
                    422,
                    'LEAVE_SERVICE_SHORT'
                );
            }
        }

        if ($type->min_notice_days > 0) {
            $earliest = Carbon::today()->addDays($type->min_notice_days);

            if ($from->lessThan($earliest)) {
                throw new ApiException(
                    $type->name . ' ke liye ' . $type->min_notice_days . ' din pehle apply karna padta hai.',
                    422,
                    'LEAVE_NOTICE_SHORT'
                );
            }
        }
    }

    private function assertWithinStreak(LeaveType $type, float $count): void
    {
        if ($type->max_consecutive_days !== null && $count > $type->max_consecutive_days) {
            throw new ApiException(
                $type->name . ' ek baar mein ' . $type->max_consecutive_days . ' din se zyada nahi le sakte.',
                422,
                'LEAVE_STREAK_LIMIT'
            );
        }
    }

    private function assertNoOverlap(Employee $employee, array $dates): void
    {
        $clash = DB::table('leave_request_days')
            ->where('employee_id', $employee->id)
            ->whereIn('leave_date', $dates)
            ->whereIn('status', [LeaveRequest::PENDING, LeaveRequest::APPROVED])
            ->orderBy('leave_date')
            ->first(['leave_date', 'status']);

        if ($clash !== null) {
            throw new ApiException(
                Carbon::parse($clash->leave_date)->format('d M Y') . ' par pehle se ek leave '
                    . $clash->status . ' hai.',
                409,
                'LEAVE_OVERLAP'
            );
        }
    }

    private function assertBalance(Employee $employee, LeaveType $type, Carbon $from, float $count, User $actor): void
    {
        $year = (int) $from->format('Y');
        $balance = $this->balances->ensureBalance($employee, $type, $year, $actor);
        $pending = $this->balances->pendingDays($employee, $type, $year);
        $usable = round($balance->available - $pending, 2);

        if ($count > $usable) {
            throw new ApiException(
                $type->name . ' mein ' . $usable . ' din bache hain, aap ' . $count . ' din maang rahe ho.'
                    . ($pending > 0 ? ' (' . $pending . ' din already approval ka intezaar kar rahe hain.)' : ''),
                422,
                'LEAVE_BALANCE_SHORT'
            );
        }
    }

    private function documentId(Employee $employee, array $data, LeaveType $type): ?int
    {
        $documentId = isset($data['document_id']) ? (int) $data['document_id'] : null;

        if ($documentId === null) {
            if ($type->requires_document) {
                throw new ApiException(
                    $type->name . ' ke liye document attach karna zaroori hai.',
                    422,
                    'LEAVE_DOCUMENT_REQUIRED'
                );
            }

            return null;
        }

        $owned = EmployeeDocument::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->whereKey($documentId)
            ->where('employee_id', $employee->id)
            ->exists();

        if (! $owned) {
            throw new ApiException('Ye document is employee ka nahi hai.', 422, 'LEAVE_DOCUMENT_INVALID');
        }

        return $documentId;
    }

    private function assertPending(LeaveRequest $request): void
    {
        if (! $request->isPending()) {
            throw new ApiException(
                'Ye leave already ' . $request->status . ' hai.',
                409,
                'LEAVE_ALREADY_DECIDED'
            );
        }
    }

    private function assertCanDecide(LeaveRequest $request, User $actor): void
    {
        if ((int) $request->employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Apni leave khud approve nahi kar sakte.', 403, 'LEAVE_SELF_APPROVAL');
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(self::APPROVE_PERMISSION)) {
            return;
        }

        if ((int) $request->employee->reporting_manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Aap is leave par decision nahi le sakte.', 403, 'FORBIDDEN');
    }

    private function assertCanCancel(LeaveRequest $request, User $actor): void
    {
        $isOwner = (int) $request->employee->user_id === (int) $actor->id;
        $isManager = $actor->isSuperAdmin() || $actor->hasPermission(self::APPROVE_PERMISSION);

        if (! $isOwner && ! $isManager) {
            throw new ApiException('Ye leave cancel karne ki permission nahi hai.', 403, 'FORBIDDEN');
        }

        if ($request->status === LeaveRequest::CANCELLED) {
            throw new ApiException('Ye leave already cancelled hai.', 409, 'LEAVE_ALREADY_CANCELLED');
        }

        if ($request->status === LeaveRequest::REJECTED) {
            throw new ApiException('Rejected leave cancel nahi hoti.', 409, 'LEAVE_ALREADY_DECIDED');
        }

        if ($request->isApproved() && $request->from_date->lessThan(Carbon::today())) {
            throw new ApiException(
                'Guzar chuki leave cancel nahi ho sakti. HR se attendance regularize karwao.',
                409,
                'LEAVE_ALREADY_TAKEN'
            );
        }
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::LEAVES, TenantCache::LEAVE_BALANCES);
    }
}

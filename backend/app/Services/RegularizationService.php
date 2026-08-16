<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AttendanceRegularization;
use App\Models\Employee;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Realtime;
use App\Support\Recipients;
use App\Support\TenantCache;
use App\Support\WorkCalendar;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class RegularizationService
{
    public function __construct(
        private readonly AttendanceService $attendance,
        private readonly NotificationService $notifications
    ) {}

    public function apply(User $actor, array $data): AttendanceRegularization
    {
        $employee = $this->employeeFor($actor, isset($data['employee_id']) ? (int) $data['employee_id'] : null);
        $date = Carbon::parse($data['attendance_date'])->startOfDay();

        $this->assertWithinWindow($employee, $date, $actor);

        $state = $this->attendance->dayState($employee, $date);

        $this->assertNeedsFix($state);

        [$in, $out] = $this->resolveTimes($state, $date, $data);

        $request = DB::transaction(function () use ($employee, $date, $state, $in, $out, $data, $actor): AttendanceRegularization {
            $request = new AttendanceRegularization([
                'attendance_date' => $date->toDateString(),
                'requested_check_in' => $in?->toDateTimeString(),
                'requested_check_out' => $out?->toDateTimeString(),
                'reason' => $data['reason'],
            ]);

            $request->company_id = $employee->company_id;
            $request->employee_id = $employee->id;
            $request->type = $this->typeFor($state, $in);
            $request->previous_check_in = $state['first_check_in_at'];
            $request->previous_check_out = $state['last_check_out_at'];
            $request->previous_status = $state['status'];
            $request->applied_by = $actor->id;
            $request->created_by = $actor->id;
            $request->save();

            $this->flush();

            return $request->refresh()->load('employee.user');
        });

        $this->notifyApprovers($request, $actor);
        $this->broadcast($request);

        return $request;
    }

    public function approve(AttendanceRegularization $request, array $data, User $actor): AttendanceRegularization
    {
        $this->assertCanDecide($request, $actor);
        $this->assertPending($request);

        $request = DB::transaction(function () use ($request, $data, $actor): AttendanceRegularization {
            $attendance = $this->attendance->applyRegularization(
                $request->employee,
                $request->attendance_date,
                $request->requested_check_in,
                $request->requested_check_out,
                $actor
            );

            $request->forceFill([
                'status' => AttendanceRegularization::APPROVED,
                'approver_id' => $actor->id,
                'decided_at' => Carbon::now(),
                'decision_remarks' => $data['remarks'] ?? null,
                'attendance_id' => $attendance->id,
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();

            return $request->refresh()->load('employee.user', 'approver', 'attendance');
        });

        $this->notifyEmployee($request, $actor, NotificationType::REGULARIZATION_APPROVED);
        $this->broadcast($request);

        return $request;
    }

    public function reject(AttendanceRegularization $request, array $data, User $actor): AttendanceRegularization
    {
        $this->assertCanDecide($request, $actor);
        $this->assertPending($request);

        $request = DB::transaction(function () use ($request, $data, $actor): AttendanceRegularization {
            $request->forceFill([
                'status' => AttendanceRegularization::REJECTED,
                'approver_id' => $actor->id,
                'decided_at' => Carbon::now(),
                'decision_remarks' => $data['remarks'],
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();

            return $request->refresh()->load('employee.user', 'approver');
        });

        $this->notifyEmployee($request, $actor, NotificationType::REGULARIZATION_REJECTED);
        $this->broadcast($request);

        return $request;
    }

    public function cancel(AttendanceRegularization $request, User $actor): AttendanceRegularization
    {
        if ((int) $request->employee->user_id !== (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Sirf apni request cancel kar sakte ho.', 403, 'FORBIDDEN');
        }

        if (! $request->isPending()) {
            throw new ApiException(
                'Ye request already ' . $request->status . ' hai.',
                409,
                'REGULARIZATION_ALREADY_DECIDED'
            );
        }

        $request->forceFill([
            'status' => AttendanceRegularization::CANCELLED,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $this->broadcast($request);

        return $request->refresh()->load('employee.user');
    }

    public function eligibleDays(User $actor, ?int $employeeId, string $from, string $to): array
    {
        $employee = $this->employeeFor($actor, $employeeId);
        $start = Carbon::parse($from)->startOfDay();
        $end = Carbon::parse($to)->startOfDay();

        if ($start->greaterThan($end)) {
            throw new ApiException('From date, to date se aage nahi ho sakti.', 422, 'DATE_RANGE_INVALID');
        }

        if ($start->diffInDays($end) > 92) {
            throw new ApiException('Ek baar mein 3 mahine se zyada nahi.', 422, 'DATE_RANGE_TOO_WIDE');
        }

        $openDates = AttendanceRegularization::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', [AttendanceRegularization::PENDING, AttendanceRegularization::APPROVED])
            ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
            ->pluck('status', 'attendance_date')
            ->all();

        $windowStart = $this->windowStart($employee);
        $today = Carbon::today();
        $days = [];

        for ($date = $start->copy(); $date->lessThanOrEqualTo($end); $date->addDay()) {
            if ($date->greaterThan($today)) {
                break;
            }

            $state = $this->attendance->dayState($employee, $date);

            if ($state['gap'] === null) {
                continue;
            }

            $key = $date->toDateString();
            $existing = $openDates[$key] ?? null;

            $days[] = [
                'date' => $key,
                'weekday' => $date->format('l'),
                'gap' => $state['gap'],
                'gap_label' => AttendanceRegularization::TYPE_LABELS[$state['gap']] ?? $state['gap'],
                'status' => $state['status'],
                'punch_count' => $state['punch_count'],
                'worked_minutes' => $state['worked_minutes'],
                'first_check_in_at' => $state['first_check_in_at'],
                'last_check_out_at' => $state['last_check_out_at'],
                'can_regularize' => $existing === null && $date->greaterThanOrEqualTo($windowStart),
                'existing_request' => $existing,
                'blocked_reason' => $this->blockedReason($existing, $date, $windowStart),
            ];
        }

        return [
            'employee_id' => (int) $employee->id,
            'from' => $start->toDateString(),
            'to' => $end->toDateString(),
            'window_days' => $this->windowDays($employee),
            'window_start' => $windowStart->toDateString(),
            'total' => count($days),
            'days' => $days,
        ];
    }

    public function summary(User $actor, string $month): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $employeeIds = Employee::query()->visibleTo($actor)->pluck('id');

        $rows = DB::table('attendance_regularizations as r')
            ->join('employees as e', 'e.id', '=', 'r.employee_id')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->whereIn('r.employee_id', $employeeIds)
            ->where('r.is_active', 1)
            ->whereBetween('r.attendance_date', [$start->toDateString(), $end->toDateString()])
            ->groupBy('r.employee_id', 'e.employee_code', 'u.name')
            ->orderByDesc(DB::raw('COUNT(*)'))
            ->get([
                'r.employee_id',
                'e.employee_code',
                'u.name as employee_name',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(r.status = 'pending') as pending"),
                DB::raw("SUM(r.status = 'approved') as approved"),
                DB::raw("SUM(r.status = 'rejected') as rejected"),
                DB::raw("SUM(r.type = 'missing_punch') as missing_punch"),
                DB::raw("SUM(r.type = 'missing_checkout') as missing_checkout"),
                DB::raw("SUM(r.type = 'short_hours') as short_hours"),
            ]);

        $employees = $rows->map(fn ($row): array => [
            'employee_id' => (int) $row->employee_id,
            'employee_code' => $row->employee_code,
            'employee_name' => $row->employee_name,
            'total' => (int) $row->total,
            'pending' => (int) $row->pending,
            'approved' => (int) $row->approved,
            'rejected' => (int) $row->rejected,
            'by_type' => [
                'missing_punch' => (int) $row->missing_punch,
                'missing_checkout' => (int) $row->missing_checkout,
                'short_hours' => (int) $row->short_hours,
            ],
        ])->all();

        return [
            'month' => $start->format('Y-m'),
            'employees_with_requests' => count($employees),
            'total_requests' => array_sum(array_column($employees, 'total')),
            'pending' => array_sum(array_column($employees, 'pending')),
            'approved' => array_sum(array_column($employees, 'approved')),
            'employees' => $employees,
        ];
    }

    private function resolveTimes(array $state, Carbon $date, array $data): array
    {
        $in = isset($data['requested_check_in']) ? $this->onDate($date, $data['requested_check_in']) : null;
        $out = isset($data['requested_check_out']) ? $this->onDate($date, $data['requested_check_out']) : null;

        if ($state['gap'] === AttendanceService::GAP_MISSING_CHECKOUT && $in === null) {
            if ($out === null) {
                throw new ApiException(
                    'Check-out ka time do — check-in already laga hua hai.',
                    422,
                    'REGULARIZATION_CHECKOUT_REQUIRED'
                );
            }

            $previousIn = Carbon::parse($state['first_check_in_at']);

            if ($out->lessThanOrEqualTo($previousIn)) {
                throw new ApiException(
                    'Check-out, check-in (' . $previousIn->format('h:i A') . ') ke baad hona chahiye.',
                    422,
                    'REGULARIZATION_TIME_INVALID'
                );
            }

            return [null, $out];
        }

        if ($in === null || $out === null) {
            throw new ApiException(
                'Check-in aur check-out dono ka time dena hoga.',
                422,
                'REGULARIZATION_TIME_REQUIRED'
            );
        }

        if ($out->lessThanOrEqualTo($in)) {
            throw new ApiException('Check-out, check-in ke baad hona chahiye.', 422, 'REGULARIZATION_TIME_INVALID');
        }

        if ($in->diffInMinutes($out) > 1440) {
            throw new ApiException('Ek din mein 24 ghante se zyada nahi.', 422, 'REGULARIZATION_TIME_INVALID');
        }

        return [$in, $out];
    }

    private function onDate(Carbon $date, string $time): Carbon
    {
        return Carbon::createFromFormat('Y-m-d H:i', $date->toDateString() . ' ' . substr($time, 0, 5));
    }

    private function typeFor(array $state, ?Carbon $in): string
    {
        if ($state['gap'] === AttendanceService::GAP_MISSING_CHECKOUT && $in === null) {
            return AttendanceRegularization::MISSING_CHECKOUT;
        }

        return match ($state['gap']) {
            AttendanceService::GAP_MISSING_PUNCH => AttendanceRegularization::MISSING_PUNCH,
            AttendanceService::GAP_MISSING_CHECKOUT => AttendanceRegularization::MISSING_CHECKOUT,
            AttendanceService::GAP_SHORT_HOURS => AttendanceRegularization::SHORT_HOURS,
            default => AttendanceRegularization::WRONG_TIME,
        };
    }

    private function assertNeedsFix(array $state): void
    {
        if (! $state['is_working_day']) {
            throw new ApiException(
                $state['day_type'] === WorkCalendar::HOLIDAY
                    ? 'Us din holiday tha — regularization ki zarurat nahi.'
                    : 'Us din week off tha — regularization ki zarurat nahi.',
                422,
                'REGULARIZATION_NOT_NEEDED'
            );
        }

        if ($state['leave_portion'] >= 1) {
            throw new ApiException(
                'Us din aapki approved leave hai — LOP nahi lagegi.',
                422,
                'REGULARIZATION_ON_LEAVE'
            );
        }

        if ($state['gap'] === null) {
            throw new ApiException(
                'Us din ki attendance already poori hai.',
                422,
                'REGULARIZATION_NOT_NEEDED'
            );
        }
    }

    private function assertWithinWindow(Employee $employee, Carbon $date, User $actor): void
    {
        if ($date->greaterThan(Carbon::today())) {
            throw new ApiException('Aane wale din ki regularization nahi hoti.', 422, 'REGULARIZATION_FUTURE_DATE');
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(AttendanceRegularization::APPROVE_PERMISSION)) {
            return;
        }

        $windowStart = $this->windowStart($employee);

        if ($date->lessThan($windowStart)) {
            throw new ApiException(
                'Sirf pichle ' . $this->windowDays($employee) . ' din ki regularization ho sakti hai. '
                    . 'Isse purani date ke liye HR se baat karo.',
                422,
                'REGULARIZATION_WINDOW_CLOSED'
            );
        }
    }

    private function windowDays(Employee $employee): int
    {
        $days = DB::table('companies')->where('id', $employee->company_id)->value('regularization_days');

        return $days === null ? AttendanceRegularization::DEFAULT_WINDOW_DAYS : (int) $days;
    }

    private function windowStart(Employee $employee): Carbon
    {
        return Carbon::today()->subDays($this->windowDays($employee));
    }

    private function blockedReason(?string $existing, Carbon $date, Carbon $windowStart): ?string
    {
        if ($existing !== null) {
            return 'Is din ki request already ' . $existing . ' hai.';
        }

        if ($date->lessThan($windowStart)) {
            return 'Window band ho gayi — HR se baat karo.';
        }

        return null;
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        if ($employeeId === null) {
            $employee = Employee::query()->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Regularization ke liye employee record chahiye. HR se onboarding karwao.',
                    422,
                    'EMPLOYEE_RECORD_MISSING'
                );
            }

            return $employee;
        }

        if (! $actor->isSuperAdmin() && ! $actor->hasPermission(AttendanceRegularization::APPROVE_PERMISSION)) {
            throw new ApiException(
                'Kisi aur ki regularization daalne ki permission nahi hai.',
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

    private function assertPending(AttendanceRegularization $request): void
    {
        if (! $request->isPending()) {
            throw new ApiException(
                'Ye request already ' . $request->status . ' hai.',
                409,
                'REGULARIZATION_ALREADY_DECIDED'
            );
        }
    }

    private function assertCanDecide(AttendanceRegularization $request, User $actor): void
    {
        if ((int) $request->employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException(
                'Apni regularization khud approve nahi kar sakte.',
                403,
                'REGULARIZATION_SELF_APPROVAL'
            );
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(AttendanceRegularization::APPROVE_PERMISSION)) {
            return;
        }

        if ((int) $request->employee->reporting_manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Aap is request par decision nahi le sakte.', 403, 'FORBIDDEN');
    }

    private function notifyApprovers(AttendanceRegularization $request, User $actor): void
    {
        $employee = $request->employee;
        $name = $employee->user?->name ?? $employee->employee_code;

        $this->notifications->sendMany(
            Recipients::approversFor($employee, AttendanceRegularization::APPROVE_PERMISSION),
            [
                'type' => NotificationType::REGULARIZATION_REQUESTED,
                'title' => $name . ' ne attendance correction maangi hai',
                'body' => $request->attendance_date->format('d M Y') . ' · ' . $request->typeLabel()
                    . ' — ' . $request->reason,
                'action_url' => '/regularizations/' . $request->uuid,
                'entity_type' => 'attendance_regularization',
                'entity_id' => $request->id,
                'payload' => $this->payload($request),
                'dedupe_key' => 'regularization:' . $request->id,
            ],
            $actor
        );
    }

    private function notifyEmployee(AttendanceRegularization $request, User $actor, string $type): void
    {
        $approved = $type === NotificationType::REGULARIZATION_APPROVED;
        $remarks = $request->decision_remarks;

        $this->notifications->send((int) $request->employee->user_id, [
            'type' => $type,
            'title' => 'Attendance correction ' . ($approved ? 'approve' : 'reject') . ' ho gayi',
            'body' => $request->attendance_date->format('d M Y')
                . ($approved ? ' — attendance update ho gayi, LOP nahi lagegi.' : '')
                . ($remarks === null ? '' : ' — ' . $remarks),
            'action_url' => '/regularizations/' . $request->uuid,
            'entity_type' => 'attendance_regularization',
            'entity_id' => $request->id,
            'payload' => $this->payload($request),
        ], $actor);
    }

    private function broadcast(AttendanceRegularization $request): void
    {
        $employee = $request->employee;

        Realtime::toUsers(
            array_merge(
                Recipients::approversFor($employee, AttendanceRegularization::APPROVE_PERMISSION),
                [(int) $employee->user_id]
            ),
            'regularization.changed',
            $this->payload($request)
        );
    }

    private function payload(AttendanceRegularization $request): array
    {
        return [
            'regularization_id' => (int) $request->id,
            'regularization_uuid' => $request->uuid,
            'employee_id' => (int) $request->employee_id,
            'employee_name' => $request->employee->user?->name,
            'attendance_date' => $request->attendance_date->toDateString(),
            'type' => $request->type,
            'status' => $request->status,
        ];
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::ATTENDANCE);
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Attendance;
use App\Models\AttendanceDetail;
use App\Models\Employee;
use App\Models\User;
use App\Models\WorkShift;
use App\Support\AttendanceCache;
use App\Support\Realtime;
use App\Support\WorkCalendar;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AttendanceService
{
    public const REGULARIZED = 'regularized';

    public const GAP_MISSING_PUNCH = 'missing_punch';

    public const GAP_MISSING_CHECKOUT = 'missing_checkout';

    public const GAP_SHORT_HOURS = 'short_hours';

    public function checkIn(User $actor, array $data, Request $request): Attendance
    {
        $employee = $this->employeeFor($actor);
        $now = Carbon::now();
        $day = WorkCalendar::day($employee, $now);

        $this->assertWorkingDay($day);

        $attendance = DB::transaction(function () use ($employee, $actor, $data, $request, $now, $day): Attendance {
            $this->assertNotCheckedIn($employee);

            $shift = WorkCalendar::shiftFor($employee);
            $attendance = $this->attendanceForDate($employee, $now, $shift);

            $detail = new AttendanceDetail([
                'check_in_at' => $now,
                'check_in_latitude' => $data['latitude'] ?? null,
                'check_in_longitude' => $data['longitude'] ?? null,
                'check_in_ip' => $request->ip(),
            ]);
            $detail->company_id = $employee->company_id;
            $detail->attendance_id = $attendance->id;
            $detail->employee_id = $employee->id;
            $detail->created_by = $actor->id;
            $detail->save();

            if ($attendance->first_check_in_at === null) {
                $attendance->forceFill(['first_check_in_at' => $now])->save();
            }

            $this->recalculate($attendance, $shift);
            $this->forget($employee, $attendance);

            return $attendance->refresh()->load('openDetail');
        });

        $this->broadcast($employee, $attendance, 'checked_in');

        return $attendance;
    }

    public function checkOut(User $actor, array $data, Request $request): Attendance
    {
        $employee = $this->employeeFor($actor);
        $now = Carbon::now();

        $attendance = DB::transaction(function () use ($employee, $actor, $data, $request, $now): Attendance {
            $detail = AttendanceDetail::query()
                ->where('employee_id', $employee->id)
                ->whereNull('check_out_at')
                ->lockForUpdate()
                ->first();

            if ($detail === null) {
                throw new ApiException('You are not checked in right now.', 409, 'ATTENDANCE_NOT_CHECKED_IN');
            }

            $detail->forceFill([
                'check_out_at' => $now,
                'check_out_latitude' => $data['latitude'] ?? null,
                'check_out_longitude' => $data['longitude'] ?? null,
                'check_out_ip' => $request->ip(),
                'worked_minutes' => (int) $detail->check_in_at->diffInMinutes($now),
                'updated_by' => $actor->id,
            ])->save();

            $attendance = Attendance::query()->whereKey($detail->attendance_id)->firstOrFail();
            $attendance->forceFill(['last_check_out_at' => $now])->save();

            $this->recalculate($attendance, WorkCalendar::shiftFor($employee));
            $this->forget($employee, $attendance);

            return $attendance->refresh()->load('details');
        });

        $this->broadcast($employee, $attendance, 'checked_out');

        return $attendance;
    }

    public function recalculateFor(Attendance $attendance, Employee $employee): void
    {
        $this->recalculate($attendance, WorkCalendar::shiftFor($employee));
        $this->forget($employee, $attendance);
    }

    public function dayState(Employee $employee, Carbon $date): array
    {
        $day = WorkCalendar::day($employee, $date);
        $shift = WorkCalendar::shiftFor($employee);

        $attendance = Attendance::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', $date->toDateString())
            ->first();

        $totals = $attendance === null ? null : DB::selectOne(
            'SELECT COUNT(*) AS punches,
                    SUM(d.check_out_at IS NULL) AS open_punches,
                    MIN(d.check_in_at) AS first_in,
                    MAX(d.check_out_at) AS last_out
             FROM attendance_details d
             WHERE d.attendance_id = ?',
            [$attendance->id]
        );

        $punches = (int) ($totals->punches ?? 0);
        $hasOpen = (int) ($totals->open_punches ?? 0) > 0;
        $worked = (int) ($attendance->worked_minutes ?? 0);

        return [
            'date' => $date->toDateString(),
            'weekday' => $date->format('l'),
            'day_type' => $day['day_type'],
            'is_working_day' => $day['is_working_day'],
            'leave_portion' => $day['leave_portion'],
            'holiday' => $day['holiday'],
            'attendance_id' => $attendance?->id,
            'status' => $attendance?->status,
            'punch_count' => $punches,
            'worked_minutes' => $worked,
            'has_open_punch' => $hasOpen,
            'first_check_in_at' => $totals->first_in ?? null,
            'last_check_out_at' => $totals->last_out ?? null,
            'gap' => $this->gapType($day, $punches, $hasOpen, $worked, $shift),
        ];
    }

    public function applyRegularization(Employee $employee, Carbon $date, ?Carbon $in, ?Carbon $out, User $actor): Attendance
    {
        return DB::transaction(function () use ($employee, $date, $in, $out, $actor): Attendance {
            $shift = WorkCalendar::shiftFor($employee);
            $attendance = $this->attendanceForDate($employee, $date, $shift);

            $open = AttendanceDetail::query()
                ->where('attendance_id', $attendance->id)
                ->whereNull('check_out_at')
                ->lockForUpdate()
                ->first();

            if ($open !== null && $in === null && $out !== null) {
                $open->forceFill([
                    'check_out_at' => $out,
                    'worked_minutes' => max(0, (int) $open->check_in_at->diffInMinutes($out)),
                    'source' => self::REGULARIZED,
                    'updated_by' => $actor->id,
                ])->save();
            } else {
                if ($open !== null) {
                    $open->forceFill([
                        'check_out_at' => $out ?? $open->check_in_at,
                        'worked_minutes' => 0,
                        'source' => self::REGULARIZED,
                        'updated_by' => $actor->id,
                    ])->save();
                }

                $detail = new AttendanceDetail([
                    'check_in_at' => $in,
                    'check_out_at' => $out,
                    'worked_minutes' => $out === null ? 0 : max(0, (int) $in->diffInMinutes($out)),
                    'source' => self::REGULARIZED,
                ]);

                $detail->company_id = $employee->company_id;
                $detail->attendance_id = $attendance->id;
                $detail->employee_id = $employee->id;
                $detail->created_by = $actor->id;
                $detail->save();
            }

            $attendance->forceFill([
                'source' => self::REGULARIZED,
                'updated_by' => $actor->id,
            ])->save();

            $this->recalculate($attendance, $shift);
            $this->forget($employee, $attendance);

            return $attendance->refresh();
        });
    }

    private function gapType(array $day, int $punches, bool $hasOpen, int $worked, ?WorkShift $shift): ?string
    {
        if (! $day['is_working_day'] || $day['leave_portion'] >= 1) {
            return null;
        }

        if ($punches === 0) {
            return self::GAP_MISSING_PUNCH;
        }

        if ($hasOpen) {
            return self::GAP_MISSING_CHECKOUT;
        }

        $full = $shift?->full_day_minutes;

        if ($full !== null && $worked < (int) $full) {
            return self::GAP_SHORT_HOURS;
        }

        return null;
    }

    public function setLeavePortion(Employee $employee, string $date, float $portion, User $actor): void
    {
        DB::transaction(function () use ($employee, $date, $portion, $actor): void {
            $shift = WorkCalendar::shiftFor($employee);

            $attendance = Attendance::query()
                ->where('employee_id', $employee->id)
                ->whereDate('attendance_date', $date)
                ->lockForUpdate()
                ->first();

            if ($attendance === null) {
                if ($portion <= 0) {
                    return;
                }

                $attendance = $this->attendanceForDate($employee, Carbon::parse($date), $shift);
                $attendance->forceFill(['source' => 'leave'])->save();
            }

            $attendance->forceFill(['leave_portion' => $portion, 'updated_by' => $actor->id])->save();

            $this->recalculate($attendance, $shift);
            $this->forget($employee, $attendance);
        });
    }

    public function today(User $actor): array
    {
        $employee = $this->employeeFor($actor);
        $date = Carbon::today();

        $row = AttendanceCache::state(
            $employee->id,
            $date->toDateString(),
            fn (): array => $this->todayRow($employee->id, $date->toDateString())
        );

        return $this->presentState($date->toDateString(), $row, WorkCalendar::day($employee, $date));
    }

    public function calendar(User $actor, string $month, ?int $employeeId): array
    {
        $employee = $this->calendarEmployee($actor, $employeeId);
        $start = Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $today = Carbon::today();

        $records = Attendance::query()
            ->where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
            ->get()
            ->keyBy(fn (Attendance $attendance): string => $attendance->attendance_date->format('Y-m-d'));

        $days = [];
        $summary = [];

        for ($date = $start->copy(); $date->lessThanOrEqualTo($end); $date->addDay()) {
            $key = $date->toDateString();
            $day = WorkCalendar::day($employee, $date);
            $record = $records->get($key);
            $status = $this->dayStatus($day, $record, $date, $today);

            $days[] = [
                'date' => $key,
                'weekday' => $date->format('l'),
                'day_type' => $day['day_type'],
                'is_working_day' => $day['is_working_day'],
                'holiday' => $day['holiday'],
                'leave_portion' => (float) ($day['leave_portion'] ?? 0),
                'status' => $status,
                'worked_minutes' => (int) ($record?->worked_minutes ?? 0),
                'worked_human' => Attendance::humanDuration((int) ($record?->worked_minutes ?? 0)),
                'is_late' => (bool) ($record?->is_late ?? false),
                'late_minutes' => (int) ($record?->late_minutes ?? 0),
                'first_check_in_at' => $record?->first_check_in_at?->toDateTimeString(),
                'last_check_out_at' => $record?->last_check_out_at?->toDateTimeString(),
                'attendance_id' => $record?->id,
            ];

            if ($status !== null) {
                $summary[$status] = ($summary[$status] ?? 0) + 1;
            }
        }

        return [
            'month' => $start->format('Y-m'),
            'employee_id' => $employee->id,
            'shift' => WorkCalendar::day($employee, $start)['shift'],
            'summary' => array_merge($summary, [
                'late' => $records->where('is_late', true)->count(),
                'worked_minutes' => (int) $records->sum('worked_minutes'),
                'worked_human' => Attendance::humanDuration((int) $records->sum('worked_minutes')),
            ]),
            'days' => $days,
        ];
    }

    private function broadcast(Employee $employee, Attendance $attendance, string $action): void
    {
        Realtime::toUsers(
            [(int) $employee->user_id, (int) $employee->reporting_manager_id],
            'attendance.changed',
            [
                'action' => $action,
                'attendance_id' => (int) $attendance->id,
                'employee_id' => (int) $employee->id,
                'attendance_date' => $attendance->attendance_date->toDateString(),
                'status' => $attendance->status,
                'worked_minutes' => (int) $attendance->worked_minutes,
                'first_check_in_at' => $attendance->first_check_in_at,
                'last_check_out_at' => $attendance->last_check_out_at,
                'is_late' => (bool) $attendance->is_late,
            ]
        );
    }

    private function dayStatus(array $day, ?Attendance $record, Carbon $date, Carbon $today): ?string
    {
        if ($record !== null) {
            return $record->status;
        }

        if (! $day['is_working_day']) {
            return $day['day_type'];
        }

        return $date->greaterThan($today) ? null : Attendance::ABSENT;
    }

    private function calendarEmployee(User $actor, ?int $employeeId): Employee
    {
        if ($employeeId === null) {
            return $this->employeeFor($actor);
        }

        $employee = Employee::query()->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }

    private function todayRow(int $employeeId, string $date): array
    {
        $row = DB::selectOne(
            'SELECT a.id, a.uuid, a.status, a.worked_minutes, a.punch_count, a.is_late, a.late_minutes,
                    a.first_check_in_at, a.last_check_out_at,
                    d.check_in_at AS open_since
             FROM attendances a
             LEFT JOIN attendance_details d
                    ON d.attendance_id = a.id AND d.check_out_at IS NULL
             WHERE a.employee_id = ? AND a.attendance_date = ? AND a.deleted_at IS NULL
             LIMIT 1',
            [$employeeId, $date]
        );

        return $row === null ? [] : (array) $row;
    }

    private function presentState(string $date, array $row, array $day): array
    {
        $openSince = $row['open_since'] ?? null;
        $isOpen = $openSince !== null;
        $elapsed = $isOpen ? (int) Carbon::parse($openSince)->diffInSeconds(now()) : 0;
        $worked = (int) ($row['worked_minutes'] ?? 0) + intdiv($elapsed, 60);

        return [
            'date' => $date,
            'day_type' => $day['day_type'],
            'is_working_day' => $day['is_working_day'],
            'holiday' => $day['holiday'],
            'shift' => $day['shift'],
            'leave_portion' => (float) ($day['leave_portion'] ?? 0),

            'attendance_id' => isset($row['id']) ? (int) $row['id'] : null,
            'uuid' => $row['uuid'] ?? null,
            'status' => $row['status'] ?? ($day['is_working_day'] ? null : $day['day_type']),

            'is_checked_in' => $isOpen,
            'can_check_in' => ! $isOpen && $day['is_working_day'],
            'can_check_out' => $isOpen,
            'blocked_reason' => $this->blockedReason($day, $isOpen),

            'running_since' => $openSince,
            'running_seconds' => $elapsed,
            'first_check_in_at' => $row['first_check_in_at'] ?? null,
            'last_check_out_at' => $row['last_check_out_at'] ?? null,

            'worked_minutes' => $worked,
            'worked_human' => Attendance::humanDuration($worked),
            'punch_count' => (int) ($row['punch_count'] ?? 0),
            'is_late' => (bool) ($row['is_late'] ?? false),
            'late_minutes' => (int) ($row['late_minutes'] ?? 0),
        ];
    }

    private function blockedReason(array $day, bool $isOpen): ?string
    {
        if ($day['is_working_day'] || $isOpen) {
            return null;
        }

        return match ($day['day_type']) {
            WorkCalendar::HOLIDAY => 'Holiday: ' . $day['holiday']['name'],
            WorkCalendar::LEAVE => 'Approved leave',
            default => 'Weekly off',
        };
    }

    private function assertWorkingDay(array $day): void
    {
        if ($day['is_working_day']) {
            return;
        }

        if ($day['day_type'] === WorkCalendar::LEAVE) {
            throw new ApiException(
                'Aaj aapki approved leave hai, attendance nahi lagegi.',
                409,
                'ATTENDANCE_ON_LEAVE'
            );
        }

        if ($day['day_type'] === WorkCalendar::HOLIDAY) {
            throw new ApiException(
                'Today is a holiday (' . $day['holiday']['name'] . '). Attendance is disabled.',
                409,
                'ATTENDANCE_HOLIDAY'
            );
        }

        throw new ApiException(
            'Today is a weekly off. Attendance is disabled.',
            409,
            'ATTENDANCE_WEEK_OFF'
        );
    }

    private function employeeFor(User $actor): Employee
    {
        $employee = Employee::query()->where('user_id', $actor->id)->first();

        if ($employee === null) {
            throw new ApiException(
                'Attendance needs an employee record. Ask HR to onboard this account first.',
                422,
                'EMPLOYEE_RECORD_MISSING'
            );
        }

        return $employee;
    }

    private function assertNotCheckedIn(Employee $employee): void
    {
        $open = DB::selectOne(
            'SELECT d.check_in_at FROM attendance_details d
             WHERE d.employee_id = ? AND d.check_out_at IS NULL LIMIT 1',
            [$employee->id]
        );

        if ($open !== null) {
            throw new ApiException(
                'You are already checked in since '
                    . Carbon::parse($open->check_in_at)->format('d M Y, h:i A')
                    . '. Check out before checking in again.',
                409,
                'ATTENDANCE_ALREADY_CHECKED_IN'
            );
        }
    }

    private function attendanceForDate(Employee $employee, Carbon $date, ?WorkShift $shift): Attendance
    {
        $attendance = Attendance::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', $date->toDateString())
            ->lockForUpdate()
            ->first();

        if ($attendance !== null) {
            return $attendance;
        }

        $attendance = new Attendance(['attendance_date' => $date->toDateString()]);
        $attendance->company_id = $employee->company_id;
        $attendance->employee_id = $employee->id;
        $attendance->work_shift_id = $shift?->id;
        $attendance->created_by = $employee->user_id;
        $attendance->save();

        return $attendance;
    }

    private function recalculate(Attendance $attendance, ?WorkShift $shift): void
    {
        $totals = DB::selectOne(
            'SELECT COUNT(*) AS punches,
                    COALESCE(SUM(d.worked_minutes), 0) AS worked,
                    SUM(d.check_out_at IS NULL) AS open_punches,
                    MIN(d.check_in_at) AS first_in,
                    MAX(d.check_out_at) AS last_out
             FROM attendance_details d
             WHERE d.attendance_id = ?',
            [$attendance->id]
        );

        $worked = (int) $totals->worked;
        $isOpen = (int) $totals->open_punches > 0;

        $span = $totals->first_in !== null && $totals->last_out !== null
            ? (int) Carbon::parse($totals->first_in)->diffInMinutes(Carbon::parse($totals->last_out))
            : 0;

        $late = $shift !== null && $totals->first_in !== null
            ? $shift->lateMinutes(Carbon::parse($totals->first_in))
            : 0;

        $attendance->forceFill([
            'punch_count' => (int) $totals->punches,
            'worked_minutes' => $worked,
            'break_minutes' => max(0, $span - $worked),
            'first_check_in_at' => $totals->first_in,
            'last_check_out_at' => $totals->last_out,
            'is_late' => $late > 0,
            'late_minutes' => $late,
            'status' => $this->statusFor($shift, $worked, $isOpen, (float) $attendance->leave_portion),
        ])->save();
    }

    private function statusFor(?WorkShift $shift, int $worked, bool $isOpen, float $leave): string
    {
        if ($leave >= 1) {
            return Attendance::ON_LEAVE;
        }

        $base = $shift === null
            ? ($isOpen || $worked > 0 ? Attendance::PRESENT : Attendance::ABSENT)
            : $shift->statusFor($worked, $isOpen);

        if ($leave <= 0) {
            return $base;
        }

        return match ($base) {
            Attendance::ABSENT => Attendance::HALF_DAY,
            Attendance::HALF_DAY => Attendance::PRESENT,
            default => $base,
        };
    }

    private function forget(Employee $employee, Attendance $attendance): void
    {
        AttendanceCache::forgetState($employee->id, $attendance->attendance_date->toDateString());
        AttendanceCache::flushLists();
    }
}

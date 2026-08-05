<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Attendance;
use App\Models\AttendanceRegularization;
use App\Models\DailyReport;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Task;
use App\Models\User;
use App\Support\WorkCalendar;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class WorkRecordService
{
    public function forEmployee(User $actor, ?int $employeeId, string $month): array
    {
        $employee = $this->employeeFor($actor, $employeeId);
        [$start, $end] = $this->range($month);

        return [
            'employee' => [
                'employee_id' => (int) $employee->id,
                'employee_code' => $employee->employee_code,
                'name' => $employee->user?->name,
                'designation' => $employee->designation?->name,
                'reporting_manager' => $employee->reportingManager?->name,
            ],
            'month' => $start->format('Y-m'),
            'working_days' => $this->workingDays($employee, $start, $end),
            'tasks' => $this->taskStats($employee, $start, $end),
            'hours' => $this->hourStats($employee, $start, $end),
            'reports' => $this->reportStats($employee, $start, $end),
            'attendance' => $this->attendanceStats($employee, $start, $end),
            'blockers' => $this->blockers($employee, $start, $end),
        ];
    }

    public function forTeam(User $actor, string $month): array
    {
        [$start, $end] = $this->range($month);

        $employees = Employee::query()
            ->visibleTo($actor)
            ->with('user:id,name,branch_id')
            ->get(['id', 'company_id', 'employee_code', 'user_id', 'reporting_manager_id', 'work_shift_id']);

        $rows = [];

        foreach ($employees as $employee) {
            $tasks = $this->taskStats($employee, $start, $end);
            $hours = $this->hourStats($employee, $start, $end);
            $reports = $this->reportStats($employee, $start, $end);
            $attendance = $this->attendanceStats($employee, $start, $end);

            $rows[] = [
                'employee_id' => (int) $employee->id,
                'employee_code' => $employee->employee_code,
                'name' => $employee->user?->name,
                'tasks_assigned' => $tasks['assigned'],
                'tasks_done' => $tasks['done'],
                'tasks_overdue' => $tasks['overdue'],
                'on_time_percent' => $tasks['on_time_percent'],
                'hours_logged' => $hours['logged'],
                'report_compliance_percent' => $reports['compliance_percent'],
                'present_days' => $attendance['present'],
                'absent_days' => $attendance['absent'],
                'late_days' => $attendance['late'],
                'score' => $this->score($tasks, $reports, $attendance),
            ];
        }

        usort($rows, fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        return [
            'month' => $start->format('Y-m'),
            'headcount' => count($rows),
            'totals' => [
                'tasks_assigned' => array_sum(array_column($rows, 'tasks_assigned')),
                'tasks_done' => array_sum(array_column($rows, 'tasks_done')),
                'tasks_overdue' => array_sum(array_column($rows, 'tasks_overdue')),
                'hours_logged' => round(array_sum(array_column($rows, 'hours_logged')), 1),
            ],
            'employees' => $rows,
        ];
    }

    private function taskStats(Employee $employee, Carbon $start, Carbon $end): array
    {
        $userId = $employee->user_id;

        $row = DB::table('tasks')
            ->where('assignee_id', $userId)
            ->where('is_active', 1)
            ->whereBetween(DB::raw('DATE(created_at)'), [$start->toDateString(), $end->toDateString()])
            ->selectRaw("
                COUNT(*) as assigned,
                SUM(status = 'done') as done,
                SUM(status = 'cancelled') as cancelled,
                SUM(status NOT IN ('done','cancelled')) as open_now,
                SUM(status = 'blocked') as blocked,
                COALESCE(SUM(estimated_hours), 0) as estimated
            ")
            ->first();

        $closedInMonth = DB::table('tasks')
            ->where('assignee_id', $userId)
            ->where('is_active', 1)
            ->where('status', Task::DONE)
            ->whereBetween(DB::raw('DATE(completed_at)'), [$start->toDateString(), $end->toDateString()])
            ->selectRaw('
                COUNT(*) as closed,
                SUM(due_date IS NOT NULL AND DATE(completed_at) <= due_date) as on_time,
                SUM(due_date IS NOT NULL AND DATE(completed_at) > due_date) as late
            ')
            ->first();

        $overdue = DB::table('tasks')
            ->where('assignee_id', $userId)
            ->where('is_active', 1)
            ->whereNotIn('status', Task::CLOSED_STATUSES)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', Carbon::today())
            ->count();

        $withDue = (int) $closedInMonth->on_time + (int) $closedInMonth->late;

        return [
            'assigned' => (int) $row->assigned,
            'done' => (int) $row->done,
            'cancelled' => (int) $row->cancelled,
            'open' => (int) $row->open_now,
            'blocked' => (int) $row->blocked,
            'overdue' => $overdue,
            'closed_this_month' => (int) $closedInMonth->closed,
            'on_time' => (int) $closedInMonth->on_time,
            'late' => (int) $closedInMonth->late,
            'on_time_percent' => $withDue === 0 ? null : (int) round((int) $closedInMonth->on_time / $withDue * 100),
            'estimated_hours' => round((float) $row->estimated, 1),
        ];
    }

    private function hourStats(Employee $employee, Carbon $start, Carbon $end): array
    {
        $logged = (float) DB::table('daily_reports')
            ->where('employee_id', $employee->id)
            ->whereBetween('report_date', [$start->toDateString(), $end->toDateString()])
            ->sum('worked_hours');

        $onTasks = (float) DB::table('daily_report_items as i')
            ->join('daily_reports as r', 'r.id', '=', 'i.daily_report_id')
            ->where('r.employee_id', $employee->id)
            ->where('i.section', 'eod')
            ->whereNotNull('i.task_id')
            ->whereBetween('r.report_date', [$start->toDateString(), $end->toDateString()])
            ->sum('i.hours');

        $attendanceMinutes = (int) DB::table('attendances')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
            ->sum('worked_minutes');

        return [
            'logged' => round($logged, 1),
            'on_tasks' => round($onTasks, 1),
            'untracked' => round(max(0, $logged - $onTasks), 1),
            'attendance_hours' => round($attendanceMinutes / 60, 1),
        ];
    }

    private function reportStats(Employee $employee, Carbon $start, Carbon $end): array
    {
        $row = DB::table('daily_reports')
            ->where('employee_id', $employee->id)
            ->whereBetween('report_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw("
                COUNT(*) as total,
                SUM(sod_submitted_at IS NOT NULL) as sod,
                SUM(eod_submitted_at IS NOT NULL) as eod,
                SUM(status = 'completed') as completed,
                SUM(is_sod_late = 1 OR is_eod_late = 1) as late
            ")
            ->first();

        $expected = $this->workingDaysCount($employee, $start, $end);
        $completed = (int) $row->completed;

        return [
            'expected_days' => $expected,
            'sod_submitted' => (int) $row->sod,
            'eod_submitted' => (int) $row->eod,
            'both_submitted' => $completed,
            'missed' => max(0, $expected - $completed),
            'late_submissions' => (int) $row->late,
            'compliance_percent' => $expected === 0 ? null : (int) round($completed / $expected * 100),
        ];
    }

    private function attendanceStats(Employee $employee, Carbon $start, Carbon $end): array
    {
        $row = DB::table('attendances')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw("
                SUM(status = 'present') as present,
                SUM(status = 'half_day') as half_day,
                SUM(status = 'absent') as absent,
                SUM(status = 'on_leave') as on_leave,
                SUM(is_late = 1) as late,
                COALESCE(SUM(late_minutes), 0) as late_minutes
            ")
            ->first();

        $leaveDays = (float) DB::table('leave_request_days as d')
            ->join('leave_requests as r', 'r.id', '=', 'd.leave_request_id')
            ->where('d.employee_id', $employee->id)
            ->where('d.status', LeaveRequest::APPROVED)
            ->where('r.is_active', 1)
            ->whereBetween('d.leave_date', [$start->toDateString(), $end->toDateString()])
            ->sum('d.day_portion');

        $regularizations = DB::table('attendance_regularizations')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw("
                COUNT(*) as total,
                SUM(status = 'approved') as approved,
                SUM(status = 'pending') as pending
            ")
            ->first();

        return [
            'present' => (int) $row->present,
            'half_day' => (int) $row->half_day,
            'absent' => (int) $row->absent,
            'on_leave' => (int) $row->on_leave,
            'leave_days' => round($leaveDays, 1),
            'late' => (int) $row->late,
            'late_minutes' => (int) $row->late_minutes,
            'regularizations' => (int) $regularizations->total,
            'regularizations_approved' => (int) $regularizations->approved,
            'regularizations_pending' => (int) $regularizations->pending,
        ];
    }

    private function blockers(Employee $employee, Carbon $start, Carbon $end): array
    {
        $tasks = DB::table('tasks')
            ->where('assignee_id', $employee->user_id)
            ->where('is_active', 1)
            ->whereNotNull('blocked_reason')
            ->whereBetween(DB::raw('DATE(updated_at)'), [$start->toDateString(), $end->toDateString()])
            ->orderByDesc('updated_at')
            ->limit(10)
            ->get(['id', 'title', 'blocked_reason', 'status']);

        $eod = DB::table('daily_reports')
            ->where('employee_id', $employee->id)
            ->whereNotNull('eod_blockers')
            ->whereBetween('report_date', [$start->toDateString(), $end->toDateString()])
            ->orderByDesc('report_date')
            ->limit(10)
            ->get(['report_date', 'eod_blockers']);

        return [
            'from_tasks' => $tasks->map(fn ($t): array => [
                'task_id' => (int) $t->id,
                'title' => $t->title,
                'reason' => $t->blocked_reason,
                'status' => $t->status,
            ])->all(),
            'from_eod' => $eod->map(fn ($r): array => [
                'date' => $r->report_date,
                'note' => $r->eod_blockers,
            ])->all(),
        ];
    }

    private function workingDays(Employee $employee, Carbon $start, Carbon $end): array
    {
        $working = 0;
        $offDays = 0;
        $holidays = 0;

        for ($date = $start->copy(); $date->lessThanOrEqualTo($end); $date->addDay()) {
            $state = WorkCalendar::schedule($employee, $date);

            if ($state['day_type'] === WorkCalendar::HOLIDAY) {
                $holidays++;
            } elseif ($state['day_type'] === WorkCalendar::WEEK_OFF) {
                $offDays++;
            } else {
                $working++;
            }
        }

        return ['working' => $working, 'week_offs' => $offDays, 'holidays' => $holidays];
    }

    private function workingDaysCount(Employee $employee, Carbon $start, Carbon $end): int
    {
        $today = Carbon::today();
        $stop = $end->greaterThan($today) ? $today : $end;
        $count = 0;

        for ($date = $start->copy(); $date->lessThanOrEqualTo($stop); $date->addDay()) {
            if (WorkCalendar::schedule($employee, $date)['is_working_day']) {
                $count++;
            }
        }

        return $count;
    }

    private function score(array $tasks, array $reports, array $attendance): int
    {
        $onTime = $tasks['on_time_percent'] ?? 100;
        $compliance = $reports['compliance_percent'] ?? 100;
        $penalty = ($tasks['overdue'] * 3) + ($attendance['absent'] * 4) + ($reports['missed'] * 2);

        return max(0, min(100, (int) round(($onTime * 0.5) + ($compliance * 0.5) - $penalty)));
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        $query = Employee::query()->with('user', 'designation', 'reportingManager');

        if ($employeeId === null) {
            $employee = $query->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Work record ke liye employee record chahiye. HR se onboarding karwao.',
                    422,
                    'EMPLOYEE_RECORD_MISSING'
                );
            }

            return $employee;
        }

        $employee = $query->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }

    private function range(string $month): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfMonth();

        return [$start, $start->copy()->endOfMonth()];
    }
}

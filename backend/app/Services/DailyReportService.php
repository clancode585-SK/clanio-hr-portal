<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\Employee;
use App\Models\Task;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Realtime;
use App\Support\TenantCache;
use App\Support\WorkCalendar;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class DailyReportService
{
    private const SORT_RANK = [
        DailyReport::PENDING => 0,
        DailyReport::SOD_DONE => 1,
        DailyReport::EOD_ONLY => 2,
        DailyReport::COMPLETED => 3,
        'not_required' => 4,
    ];

    public function __construct(
        private readonly TaskService $tasks,
        private readonly NotificationService $notifications
    ) {}

    public function submitSod(User $actor, array $data): DailyReport
    {
        $employee = $this->employeeFor($actor);
        $date = $this->date($data);

        $report = DB::transaction(function () use ($employee, $date, $data, $actor): DailyReport {
            $report = $this->reportFor($employee, $date, $actor);
            $first = ! $report->hasSod();

            $report->fill(['sod_plan' => $data['sod_plan'] ?? null]);
            $report->forceFill([
                'sod_submitted_at' => $report->sod_submitted_at ?? Carbon::now(),
                'is_sod_late' => $first ? $this->isLate($employee, $date, 'sod_cutoff') : $report->is_sod_late,
                'updated_by' => $actor->id,
            ])->save();

            $this->replaceItems($report, DailyReportItem::SOD, $data['items'] ?? [], $employee);
            $this->flush();

            return $report->refresh()->load('sodItems.task', 'eodItems.task', 'employee.user');
        });

        $this->notifyManager($report, $employee, DailyReportItem::SOD, $actor);
        $this->broadcast($report, $employee, DailyReportItem::SOD);

        return $report;
    }

    public function submitEod(User $actor, array $data): DailyReport
    {
        $employee = $this->employeeFor($actor);
        $date = $this->date($data);

        $report = DB::transaction(function () use ($employee, $date, $data, $actor): DailyReport {
            $report = $this->reportFor($employee, $date, $actor);
            $first = ! $report->hasEod();

            $report->fill([
                'eod_summary' => $data['eod_summary'] ?? null,
                'eod_blockers' => $data['eod_blockers'] ?? null,
                'eod_tomorrow_plan' => $data['eod_tomorrow_plan'] ?? null,
                'worked_hours' => $data['worked_hours'] ?? null,
            ]);

            $report->forceFill([
                'eod_submitted_at' => $report->eod_submitted_at ?? Carbon::now(),
                'is_eod_late' => $first ? $this->isLate($employee, $date, 'eod_cutoff') : $report->is_eod_late,
                'updated_by' => $actor->id,
            ])->save();

            $this->replaceItems($report, DailyReportItem::EOD, $data['items'] ?? [], $employee);
            $this->flush();

            return $report->refresh()->load('sodItems.task', 'eodItems.task', 'employee.user');
        });

        $this->notifyManager($report, $employee, DailyReportItem::EOD, $actor);
        $this->broadcast($report, $employee, DailyReportItem::EOD);

        return $report;
    }

    public function forDate(User $actor, string $date): array
    {
        $employee = $this->employeeFor($actor);
        $day = Carbon::parse($date)->startOfDay();
        $schedule = WorkCalendar::day($employee, $day);

        $report = DailyReport::query()
            ->where('employee_id', $employee->id)
            ->whereDate('report_date', $day->toDateString())
            ->with('sodItems.task', 'eodItems.task', 'employee.user')
            ->first();

        return [
            'date' => $day->toDateString(),
            'weekday' => $day->format('l'),
            'day_type' => $schedule['day_type'],
            'is_required' => $schedule['is_working_day'],
            'is_editable' => $this->withinWindow($day),
            'holiday' => $schedule['holiday'],
            'leave_portion' => $schedule['leave_portion'],
            'report' => $report,
            'open_tasks' => $this->openTasks($actor),
        ];
    }

    public function teamStatus(User $actor, string $date): array
    {
        $day = Carbon::parse($date)->startOfDay();

        $employees = Employee::query()
            ->visibleTo($actor)
            ->with('user:id,name,branch_id')
            ->get(['id', 'company_id', 'employee_code', 'user_id', 'reporting_manager_id', 'work_shift_id']);

        $reports = DailyReport::query()
            ->whereIn('employee_id', $employees->pluck('id'))
            ->whereDate('report_date', $day->toDateString())
            ->get()
            ->keyBy('employee_id');

        $counts = [
            'headcount' => $employees->count(),
            'required' => 0,
            'not_required' => 0,
            'completed' => 0,
            'sod_only' => 0,
            'eod_only' => 0,
            'pending' => 0,
            'late' => 0,
        ];

        $workedHours = 0.0;
        $rows = [];

        foreach ($employees as $employee) {
            $schedule = WorkCalendar::day($employee, $day);
            $report = $reports->get($employee->id);
            $required = (bool) $schedule['is_working_day'];
            $status = $required ? ($report->status ?? DailyReport::PENDING) : 'not_required';

            if ($required) {
                $counts['required']++;
                $counts[match ($status) {
                    DailyReport::COMPLETED => 'completed',
                    DailyReport::SOD_DONE => 'sod_only',
                    DailyReport::EOD_ONLY => 'eod_only',
                    default => 'pending',
                }]++;
            } else {
                $counts['not_required']++;
            }

            if ($report !== null && ($report->is_sod_late || $report->is_eod_late)) {
                $counts['late']++;
            }

            $workedHours += (float) ($report->worked_hours ?? 0);

            $rows[] = [
                'employee_id' => (int) $employee->id,
                'employee_code' => $employee->employee_code,
                'name' => $employee->user?->name,
                'day_type' => $schedule['day_type'],
                'is_required' => $required,
                'status' => $status,
                'sod_submitted_at' => $report?->sod_submitted_at,
                'eod_submitted_at' => $report?->eod_submitted_at,
                'is_sod_late' => (bool) ($report->is_sod_late ?? false),
                'is_eod_late' => (bool) ($report->is_eod_late ?? false),
                'worked_hours' => $report?->worked_hours,
                'report_uuid' => $report?->uuid,
            ];
        }

        usort($rows, fn (array $a, array $b): int => [self::SORT_RANK[$a['status']] ?? 9, (string) $a['name']]
            <=> [self::SORT_RANK[$b['status']] ?? 9, (string) $b['name']]);

        return [
            'date' => $day->toDateString(),
            'weekday' => $day->format('l'),
            'summary' => $counts,
            'total_worked_hours' => round($workedHours, 1),
            'employees' => $rows,
        ];
    }

    private function reportFor(Employee $employee, Carbon $date, User $actor): DailyReport
    {
        $report = DailyReport::query()
            ->where('employee_id', $employee->id)
            ->whereDate('report_date', $date->toDateString())
            ->lockForUpdate()
            ->first();

        if ($report !== null) {
            return $report;
        }

        $report = new DailyReport();
        $report->company_id = $employee->company_id;
        $report->employee_id = $employee->id;
        $report->report_date = $date->toDateString();
        $report->created_by = $actor->id;
        $report->save();

        return $report;
    }

    private function replaceItems(DailyReport $report, string $section, array $items, Employee $employee): void
    {
        $isEod = $section === DailyReportItem::EOD;

        $existing = DailyReportItem::query()
            ->where('daily_report_id', $report->id)
            ->where('section', $section)
            ->get();

        foreach ($existing as $item) {
            if ($isEod && $item->task_id !== null && $item->hours > 0) {
                $this->tasks->adjustSpentHours((int) $item->task_id, -1 * (float) $item->hours);
            }

            $item->delete();
        }

        $allowed = $this->validTaskIds($employee, $items);
        $order = 0;

        foreach ($items as $row) {
            $taskId = isset($row['task_id']) ? (int) $row['task_id'] : null;

            if ($taskId !== null && ! in_array($taskId, $allowed, true)) {
                throw new ApiException(
                    'Task #' . $taskId . ' aapko assign nahi hai.',
                    422,
                    'REPORT_TASK_INVALID'
                );
            }

            $hours = isset($row['hours']) ? (float) $row['hours'] : null;

            $item = new DailyReportItem([
                'section' => $section,
                'task_id' => $taskId,
                'title' => $row['title'],
                'hours' => $hours,
                'is_completed' => (bool) ($row['is_completed'] ?? false),
                'sort_order' => $order++,
            ]);

            $item->company_id = $report->company_id;
            $item->daily_report_id = $report->id;
            $item->save();

            if ($isEod && $taskId !== null && $hours !== null && $hours > 0) {
                $this->tasks->adjustSpentHours($taskId, $hours);
            }
        }
    }

    private function validTaskIds(Employee $employee, array $items): array
    {
        $requested = array_values(array_unique(array_filter(array_map(
            fn (array $row): int => isset($row['task_id']) ? (int) $row['task_id'] : 0,
            $items
        ))));

        if ($requested === []) {
            return [];
        }

        return Task::query()
            ->where('assignee_id', $employee->user_id)
            ->whereIn('id', $requested)
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    private function openTasks(User $actor): array
    {
        return Task::query()
            ->where('assignee_id', $actor->id)
            ->open()
            ->orderByRaw("FIELD(priority, 'urgent', 'high', 'normal', 'low')")
            ->orderByRaw('due_date IS NULL, due_date')
            ->limit(50)
            ->get(['id', 'uuid', 'title', 'status', 'priority', 'due_date', 'estimated_hours', 'spent_hours'])
            ->map(fn (Task $task): array => [
                'id' => (int) $task->id,
                'uuid' => $task->uuid,
                'title' => $task->title,
                'status' => $task->status,
                'priority' => $task->priority,
                'due_date' => $task->due_date?->toDateString(),
                'estimated_hours' => $task->estimated_hours,
                'spent_hours' => $task->spent_hours,
                'is_overdue' => $task->isOverdue(),
            ])
            ->all();
    }

    private function date(array $data): Carbon
    {
        $date = isset($data['report_date'])
            ? Carbon::parse($data['report_date'])->startOfDay()
            : Carbon::today();

        if (! $this->withinWindow($date)) {
            throw new ApiException(
                'Report sirf aaj ya pichhle ' . DailyReport::BACKFILL_DAYS . ' din ke liye bhar sakte ho.',
                422,
                'REPORT_DATE_LOCKED'
            );
        }

        return $date;
    }

    private function withinWindow(Carbon $date): bool
    {
        $today = Carbon::today();

        return $date->lessThanOrEqualTo($today)
            && $date->greaterThanOrEqualTo($today->copy()->subDays(DailyReport::BACKFILL_DAYS));
    }

    private function isLate(Employee $employee, Carbon $date, string $column): bool
    {
        if (! $date->isSameDay(Carbon::today())) {
            return true;
        }

        $cutoff = DB::table('companies')->where('id', $employee->company_id)->value($column);

        if ($cutoff === null) {
            return false;
        }

        return Carbon::now()->greaterThan(Carbon::parse($date->toDateString() . ' ' . $cutoff));
    }

    private function employeeFor(User $actor): Employee
    {
        $employee = Employee::query()->where('user_id', $actor->id)->first();

        if ($employee === null) {
            throw new ApiException(
                'SOD / EOD ke liye employee record chahiye. HR se onboarding karwao.',
                422,
                'EMPLOYEE_RECORD_MISSING'
            );
        }

        return $employee;
    }

    private function notifyManager(DailyReport $report, Employee $employee, string $section, User $actor): void
    {
        $managerId = $employee->reporting_manager_id === null ? null : (int) $employee->reporting_manager_id;

        if ($managerId === null || $managerId === (int) $actor->id) {
            return;
        }

        $label = $section === DailyReportItem::SOD ? 'SOD' : 'EOD';
        $late = $section === DailyReportItem::SOD ? $report->is_sod_late : $report->is_eod_late;

        $body = $report->report_date->format('d M Y')
            . ($late ? ' · late submission' : '')
            . ($section === DailyReportItem::EOD && $report->worked_hours !== null
                ? ' · ' . $report->worked_hours . ' ghante kaam'
                : '');

        $this->notifications->send($managerId, [
            'type' => NotificationType::REPORT_SUBMITTED,
            'title' => $actor->name . ' ka ' . $label . ' aa gaya',
            'body' => $body,
            'action_url' => '/daily-reports/' . $report->uuid,
            'entity_type' => 'daily_report',
            'entity_id' => $report->id,
            'payload' => [
                'daily_report_id' => (int) $report->id,
                'employee_id' => (int) $employee->id,
                'section' => $section,
                'report_date' => $report->report_date->toDateString(),
                'status' => $report->status,
            ],
            'dedupe_key' => 'report:' . $report->id . ':' . $section,
        ], $actor);
    }

    private function broadcast(DailyReport $report, Employee $employee, string $section): void
    {
        Realtime::toUsers(
            [(int) $employee->user_id, (int) $employee->reporting_manager_id],
            'daily_report.changed',
            [
                'section' => $section,
                'daily_report_id' => (int) $report->id,
                'daily_report_uuid' => $report->uuid,
                'employee_id' => (int) $employee->id,
                'report_date' => $report->report_date->toDateString(),
                'status' => $report->status,
                'worked_hours' => $report->worked_hours,
            ]
        );
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::DAILY_REPORTS);
    }
}

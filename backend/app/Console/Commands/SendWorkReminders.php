<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\DailyReport;
use App\Models\Employee;
use App\Models\Task;
use App\Services\NotificationService;
use App\Support\NotificationType;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use App\Support\WorkCalendar;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SendWorkReminders extends Command
{
    protected $signature = 'work:reminders {--type=all : tasks | sod | eod | all}';

    protected $description = 'Task due/overdue aur SOD/EOD ke reminders bhejta hai';

    public function __construct(private readonly NotificationService $notifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $type = (string) $this->option('type');
        $sent = 0;

        foreach (Company::query()->where('status', 'active')->get(['id', 'name']) as $company) {
            app(TenantContext::class)->set($company);

            if ($type === 'tasks' || $type === 'all') {
                $sent += $this->taskDueTomorrow($company);
                $sent += $this->taskOverdue($company);
            }

            if ($type === 'sod' || $type === 'all') {
                $sent += $this->missingReport($company, 'sod');
            }

            if ($type === 'eod' || $type === 'all') {
                $sent += $this->missingReport($company, 'eod');
            }
        }

        app(TenantContext::class)->forget();

        $this->info($sent . ' reminders bheje gaye.');

        return self::SUCCESS;
    }

    private function taskDueTomorrow(Company $company): int
    {
        $tomorrow = Carbon::tomorrow()->toDateString();

        $tasks = Task::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $company->id)
            ->open()
            ->whereDate('due_date', $tomorrow)
            ->get(['id', 'uuid', 'title', 'priority', 'assignee_id', 'due_date']);

        foreach ($tasks as $task) {
            $this->notifications->send((int) $task->assignee_id, [
                'type' => NotificationType::TASK_DUE_SOON,
                'title' => 'Kal due hai: ' . $task->title,
                'body' => ucfirst($task->priority) . ' priority · ' . $task->due_date->format('d M Y'),
                'action_url' => '/tasks/' . $task->uuid,
                'entity_type' => 'task',
                'entity_id' => $task->id,
                'payload' => ['task_id' => (int) $task->id, 'due_date' => $task->due_date->toDateString()],
                'dedupe_key' => 'task:' . $task->id . ':due',
            ]);
        }

        return $tasks->count();
    }

    private function taskOverdue(Company $company): int
    {
        $tasks = Task::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $company->id)
            ->overdue()
            ->get(['id', 'uuid', 'title', 'priority', 'assignee_id', 'assigned_by', 'due_date']);

        foreach ($tasks as $task) {
            $days = (int) Carbon::parse($task->due_date)->diffInDays(Carbon::today());

            $recipients = array_values(array_unique(array_filter([
                (int) $task->assignee_id,
                $task->assigned_by === null ? null : (int) $task->assigned_by,
            ])));

            $this->notifications->sendMany($recipients, [
                'type' => NotificationType::TASK_OVERDUE,
                'title' => 'Overdue: ' . $task->title,
                'body' => $days . ' din se pending · due tha ' . $task->due_date->format('d M Y'),
                'action_url' => '/tasks/' . $task->uuid,
                'entity_type' => 'task',
                'entity_id' => $task->id,
                'payload' => ['task_id' => (int) $task->id, 'days_overdue' => $days],
                'dedupe_key' => 'task:' . $task->id . ':overdue',
            ]);
        }

        return $tasks->count();
    }

    private function missingReport(Company $company, string $section): int
    {
        $today = Carbon::today();

        $employees = Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $company->id)
            ->whereNull('deleted_at')
            ->with('user:id,name,branch_id,status')
            ->get(['id', 'company_id', 'user_id', 'work_shift_id']);

        $submitted = DB::table('daily_reports')
            ->where('company_id', $company->id)
            ->whereDate('report_date', $today->toDateString())
            ->pluck($section === 'sod' ? 'sod_submitted_at' : 'eod_submitted_at', 'employee_id')
            ->all();

        $sent = 0;

        foreach ($employees as $employee) {
            if ($employee->user === null || $employee->user->status !== 'active') {
                continue;
            }

            if (($submitted[$employee->id] ?? null) !== null) {
                continue;
            }

            if (! WorkCalendar::day($employee, $today)['is_working_day']) {
                continue;
            }

            $label = $section === 'sod' ? 'SOD' : 'EOD';

            $this->notifications->send((int) $employee->user_id, [
                'type' => $section === 'sod' ? NotificationType::SOD_PENDING : NotificationType::EOD_PENDING,
                'title' => 'Aaj ka ' . $label . ' pending hai',
                'body' => $section === 'sod'
                    ? 'Aaj kya karna hai wo likh do — 2 minute ka kaam hai.'
                    : 'Aaj kya kiya wo likh do, tabhi ghante task par judenge.',
                'action_url' => '/daily-reports/today',
                'entity_type' => 'daily_report',
                'entity_id' => null,
                'payload' => ['date' => $today->toDateString(), 'section' => $section],
                'dedupe_key' => 'report:' . $today->toDateString() . ':' . $section . ':' . $employee->id,
            ]);

            $sent++;
        }

        return $sent;
    }
}

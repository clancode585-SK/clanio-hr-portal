<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Appraisal;
use App\Models\AssetRequest;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeExit;
use App\Models\ExpenseClaim;
use App\Models\IncentiveRecord;
use App\Models\LeaveRequest;
use App\Models\PerformanceGoal;
use App\Models\Task;
use App\Models\Ticket;
use App\Models\User;
use App\Models\AttendanceRegularization;
use App\Support\CompanyTime;
use App\Support\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DashboardService
{
    /** Ek hi call me saare tile ke counts — pehle har tile apni API maarti thi */
    public function forUser(User $actor): array
    {
        $companyId = $actor->company_id === null ? null : (int) $actor->company_id;
        $employeeId = $this->employeeId($actor);

        $counts = [];

        foreach ($this->definitions($actor, $companyId, $employeeId) as $key => $resolver) {
            $counts[$key] = $this->safely($key, $resolver);
        }

        return [
            'counts' => $counts,
            'generated_at' => CompanyTime::now()->toIso8601String(),
        ];
    }

    /** @return array<string, callable> */
    private function definitions(User $actor, ?int $companyId, ?int $employeeId): array
    {
        return [
            'companies' => fn (): int => $actor->isSuperAdmin()
                ? Company::query()->withoutGlobalScopes()->where('is_active', 1)->count()
                : 0,

            'leave-approvals' => fn (): int => $this->gate($actor, 'leave.approve', fn (): int => LeaveRequest::query()
                ->visibleTo($actor)
                ->where('status', LeaveRequest::PENDING)
                ->whereHas('employee', fn (Builder $q) => $q->where('user_id', '!=', $actor->id))
                ->count()),

            'regularizations' => fn (): int => $this->gate($actor, 'attendance.regularize', fn (): int => AttendanceRegularization::query()
                ->visibleTo($actor)
                ->where('status', AttendanceRegularization::PENDING)
                ->whereHas('employee', fn (Builder $q) => $q->where('user_id', '!=', $actor->id))
                ->count()),

            'expense-verify' => fn (): int => $this->gate($actor, 'expense.verify', fn (): int => ExpenseClaim::query()
                ->visibleTo($actor)
                ->where('status', ExpenseClaim::MANAGER_APPROVED)
                ->count()),

            'expense-payout' => fn (): int => $this->gate($actor, 'expense.pay', fn (): int => ExpenseClaim::query()
                ->visibleTo($actor)
                ->where('status', ExpenseClaim::VERIFIED)
                ->count()),

            'incentives' => fn (): int => $this->gate($actor, 'incentive.approve', fn (): int => IncentiveRecord::query()
                ->visibleTo($actor)
                ->where('status', IncentiveRecord::CALCULATED)
                ->count()),

            'exits' => fn (): int => $this->gate($actor, 'exit.approve', fn (): int => EmployeeExit::query()
                ->visibleTo($actor)
                ->whereIn('status', [EmployeeExit::PENDING, EmployeeExit::MANAGER_APPROVED])
                ->count()),

            'clearance' => fn (): int => $this->gate($actor, 'clearance.sign', fn (): int => $companyId === null ? 0 : DB::table('exit_clearances')
                ->where('company_id', $companyId)
                ->where('is_active', 1)
                ->where('status', 'pending')
                ->count()),

            'asset-requests' => fn (): int => $this->anyGate($actor, ['asset.support', 'asset.manage'], fn (): int => AssetRequest::query()
                ->visibleTo($actor)
                ->whereIn('status', [AssetRequest::PENDING, AssetRequest::IN_PROGRESS])
                ->count()),

            'tickets' => fn (): int => $this->anyGate($actor, ['ticket.view_all', 'ticket.resolve'], fn (): int => Ticket::query()
                ->visibleTo($actor)
                ->whereIn('status', [Ticket::OPEN, Ticket::IN_PROGRESS])
                ->count()),

            'tickets-breached' => fn (): int => $this->anyGate($actor, ['ticket.view_all', 'ticket.resolve'], fn (): int => Ticket::query()
                ->visibleTo($actor)
                ->whereIn('status', [Ticket::OPEN, Ticket::IN_PROGRESS])
                ->whereNotNull('resolve_due_at')
                ->where('resolve_due_at', '<', CompanyTime::now())
                ->count()),

            'goal-verify' => fn (): int => $this->gate($actor, 'okr.verify', fn (): int => PerformanceGoal::query()
                ->visibleTo($actor)
                ->where('status', PerformanceGoal::ACTIVE)
                ->whereNotNull('submitted_at')
                ->whereNull('verified_at')
                ->count()),

            'appraisals' => fn (): int => $this->gate($actor, 'performance.finalise', fn (): int => Appraisal::query()
                ->visibleTo($actor)
                ->whereIn('status', [Appraisal::SELF_DONE, Appraisal::MANAGER_DONE])
                ->count()),

            'employees' => fn (): int => $this->gate($actor, 'employee.view', fn (): int => Employee::query()
                ->visibleTo($actor)
                ->where('is_active', 1)
                ->count()),

            'daily-reports' => fn (): int => $this->gate($actor, 'daily_report.view_team', fn (): int => $companyId === null ? 0 : DB::table('daily_reports')
                ->where('company_id', $companyId)
                ->whereDate('report_date', CompanyTime::now()->toDateString())
                ->count()),

            'tasks-overdue' => fn (): int => Task::query()
                ->visibleTo($actor)
                ->whereNotIn('status', [Task::DONE, Task::CANCELLED])
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', CompanyTime::now()->toDateString())
                ->count(),

            'tasks-mine' => fn (): int => Task::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('assignee_id', $actor->id)
                ->whereNotIn('status', [Task::DONE, Task::CANCELLED])
                ->count(),

            'my-policies' => fn (): int => $employeeId === null ? 0 : DB::table('policy_acknowledgements')
                ->where('employee_id', $employeeId)
                ->whereNull('acknowledged_at')
                ->count(),

            'my-leave' => fn (): float => $employeeId === null ? 0.0 : round((float) DB::table('leave_balances')
                ->where('employee_id', $employeeId)
                ->where('year', CompanyTime::now()->year)
                ->sum('available'), 1),

            'my-assets' => fn (): int => $employeeId === null ? 0 : DB::table('asset_allocations')
                ->where('employee_id', $employeeId)
                ->whereNull('returned_on')
                ->count(),

            'joining-soon' => fn (): int => $this->gate($actor, 'recruitment.view', fn (): int => $companyId === null ? 0 : DB::table('applications')
                ->where('company_id', $companyId)
                ->where('stage', 'offer')
                ->whereNotNull('joining_date')
                ->whereDate('joining_date', '>=', CompanyTime::now()->toDateString())
                ->count()),

            'my-interviews' => fn (): int => $companyId === null ? 0 : DB::table('interviews')
                ->where('company_id', $companyId)
                ->where('interviewer_id', $actor->id)
                ->where('status', 'scheduled')
                ->count(),

            'new-applicants' => fn (): int => $this->gate($actor, 'recruitment.view', fn (): int => $companyId === null ? 0 : DB::table('applications')
                ->where('company_id', $companyId)
                ->where('stage', 'applied')
                ->count()),

            'open-positions' => fn (): int => $this->gate($actor, 'recruitment.view', fn (): int => $companyId === null ? 0 : DB::table('job_openings')
                ->where('company_id', $companyId)
                ->where('status', 'published')
                ->where('is_active', 1)
                ->count()),

            'invoices-due' => fn (): int => $this->gate($actor, 'invoice.view', fn (): int => $companyId === null
                ? DB::table('invoices')->where('status', 'pending')->count()
                : DB::table('invoices')->where('company_id', $companyId)->where('status', 'pending')->count()),

            'audit-log' => fn (): int => $this->gate($actor, 'audit.view', fn (): int => $companyId === null ? 0 : DB::table('audit_logs')
                ->where('company_id', $companyId)
                ->whereDate('created_at', CompanyTime::now()->toDateString())
                ->count()),

            'notifications' => fn (): int => DB::table('notifications')
                ->where('user_id', $actor->id)
                ->whereNull('read_at')
                ->count(),
        ];
    }

    private function gate(User $actor, string $permission, callable $run): int
    {
        return $actor->hasPermission($permission) ? (int) $run() : 0;
    }

    private function anyGate(User $actor, array $permissions, callable $run): int
    {
        foreach ($permissions as $permission) {
            if ($actor->hasPermission($permission)) {
                return (int) $run();
            }
        }

        return 0;
    }

    // Ek count fail ho to poora dashboard nahi girna chahiye
    private function safely(string $key, callable $run): int|float
    {
        try {
            return $run();
        } catch (\Throwable $caught) {
            Log::warning('Dashboard count failed', ['key' => $key, 'error' => $caught->getMessage()]);

            return 0;
        }
    }

    private function employeeId(User $actor): ?int
    {
        $id = Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('user_id', $actor->id)
            ->value('id');

        return $id === null ? null : (int) $id;
    }
}

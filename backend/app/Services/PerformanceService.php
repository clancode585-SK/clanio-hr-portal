<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AppraisalCycle;
use App\Models\Employee;
use App\Models\PerformanceScore;
use App\Models\User;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PerformanceService
{
    private const MAX_TREND_MONTHS = 24;

    public function __construct(
        private readonly WorkRecordService $workRecord,
        private readonly GoalService $goals
    ) {}

    /* ---------------------------------------------------------------- score */

    /**
     * Frozen mahina DB se seedha uthta hai — dobara calculate nahi hota,
     * isi liye purana score kabhi badalta nahi.
     */
    public function scoreFor(User $actor, ?int $employeeId, string $month): array
    {
        $employee = $this->employeeFor($actor, $employeeId);
        $period = $this->period($month);

        $existing = $this->find($employee, $period);

        if ($existing !== null && $existing->isFrozen()) {
            return $this->present($existing, $employee, true);
        }

        return $this->present($this->snapshot($employee, $period, $actor), $employee, false);
    }

    public function snapshot(Employee $employee, Carbon $period, ?User $actor = null, bool $freeze = false): PerformanceScore
    {
        $start = $period->copy()->startOfMonth();
        $end = $period->copy()->endOfMonth();

        $existing = $this->find($employee, $period);

        if ($existing !== null && $existing->isFrozen() && ! $freeze) {
            return $existing;
        }

        $record = $this->workRecord->buildRecord($employee, $start, $end);
        $goalScore = $this->goals->achievement($employee, $start, $end);

        $score = $existing ?? new PerformanceScore(['period_month' => $start->toDateString()]);

        $score->company_id = $employee->company_id;
        $score->employee_id = $employee->id;

        $score->forceFill([
            'period_month' => $start->toDateString(),
            'score' => $record['score'],
            'delivery_score' => $record['score_breakdown']['delivery'],
            'discipline_score' => $record['score_breakdown']['discipline'],
            'penalty' => $record['score_breakdown']['penalty'],
            'goal_score' => $goalScore,
            'tasks_assigned' => $record['tasks']['assigned'],
            'tasks_done' => $record['tasks']['done'],
            'tasks_overdue' => $record['tasks']['overdue'],
            'on_time_percent' => $record['tasks']['on_time_percent'],
            'report_expected' => $record['reports']['expected_days'],
            'report_completed' => $record['reports']['both_submitted'],
            'report_compliance_percent' => $record['reports']['compliance_percent'],
            'present_days' => $record['attendance']['present'],
            'absent_days' => $record['attendance']['absent'],
            'late_days' => $record['attendance']['late'],
            'leave_days' => $record['attendance']['leave_days'],
            'hours_logged' => $record['hours']['logged'],
            'computed_at' => Carbon::now(),
            'updated_by' => $actor?->id,
        ]);

        if ($score->created_by === null) {
            $score->created_by = $actor?->id;
        }

        if ($freeze) {
            $score->forceFill(['is_frozen' => true, 'frozen_at' => Carbon::now()]);
        }

        $score->save();

        TenantCache::flush(TenantCache::PERFORMANCE);

        return $score->refresh();
    }

    public function freeze(User $actor, string $month): array
    {
        $this->assertPermission($actor, AppraisalCycle::MANAGE_PERMISSION, 'score freeze karne');

        $period = $this->period($month);

        if ($period->greaterThanOrEqualTo(Carbon::today()->startOfMonth())) {
            throw new ApiException(
                'Chalu mahina freeze nahi hota — month khatam hone ke baad karo.',
                422,
                'PERFORMANCE_MONTH_OPEN'
            );
        }

        $frozen = $this->snapshotCompany((int) $actor->company_id, $period, true, $actor);

        return ['month' => $period->format('Y-m'), 'frozen' => $frozen];
    }

    public function snapshotCompany(int $companyId, Carbon $period, bool $freeze, ?User $actor = null): int
    {
        $employees = Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->where('employment_status', '!=', Employee::EMPLOYMENT_EXITED)
            ->get(['id', 'company_id', 'user_id', 'employee_code', 'work_shift_id']);

        $count = 0;

        foreach ($employees as $employee) {
            $this->snapshot($employee, $period, $actor, $freeze);
            $count++;
        }

        return $count;
    }

    public function trend(User $actor, ?int $employeeId, int $months): array
    {
        $employee = $this->employeeFor($actor, $employeeId);
        $months = max(1, min(self::MAX_TREND_MONTHS, $months));

        $from = Carbon::today()->startOfMonth()->subMonths($months - 1);

        $rows = PerformanceScore::query()
            ->where('employee_id', $employee->id)
            ->whereDate('period_month', '>=', $from->toDateString())
            ->orderBy('period_month')
            ->get();

        $byMonth = $rows->keyBy(fn (PerformanceScore $row): string => $row->period_month->format('Y-m'));
        $series = [];

        for ($i = 0; $i < $months; $i++) {
            $period = $from->copy()->addMonths($i);
            $key = $period->format('Y-m');
            $row = $byMonth->get($key);

            if ($row === null && $period->lessThanOrEqualTo(Carbon::today())) {
                $row = $this->snapshot($employee, $period, $actor);
            }

            $series[] = [
                'month' => $key,
                'score' => $row?->score,
                'goal_score' => $row?->goal_score,
                'on_time_percent' => $row?->on_time_percent,
                'report_compliance_percent' => $row?->report_compliance_percent,
                'is_frozen' => (bool) $row?->is_frozen,
            ];
        }

        $scored = array_values(array_filter(array_column($series, 'score'), fn ($v): bool => $v !== null));

        return [
            'employee_id' => (int) $employee->id,
            'employee_name' => $employee->user?->name,
            'months' => $months,
            'average_score' => $scored === [] ? null : (int) round(array_sum($scored) / count($scored)),
            'best_month' => $scored === [] ? null : max($scored),
            'worst_month' => $scored === [] ? null : min($scored),
            'series' => $series,
        ];
    }

    /* -------------------------------------------------------------- weights */

    public function weights(User $actor): array
    {
        return $this->workRecord->weights((int) $actor->company_id);
    }

    public function updateWeights(User $actor, array $data): array
    {
        $this->assertPermission($actor, AppraisalCycle::MANAGE_PERMISSION, 'weights badalne');

        $delivery = (int) $data['delivery'];
        $discipline = (int) $data['discipline'];

        if ($delivery + $discipline !== 100) {
            throw new ApiException(
                'Delivery aur discipline ka total 100 hona chahiye (abhi ' . ($delivery + $discipline) . ').',
                422,
                'PERFORMANCE_WEIGHT_INVALID'
            );
        }

        DB::table('companies')->where('id', $actor->company_id)->update([
            'perf_delivery_weight' => $delivery,
            'perf_discipline_weight' => $discipline,
            'perf_overdue_penalty' => (int) ($data['overdue_penalty'] ?? 3),
            'perf_absent_penalty' => (int) ($data['absent_penalty'] ?? 4),
            'perf_missed_report_penalty' => (int) ($data['missed_report_penalty'] ?? 2),
            'updated_at' => Carbon::now(),
        ]);

        TenantCache::flush(TenantCache::PERFORMANCE, TenantCache::COMPANIES);

        return $this->workRecord->weights((int) $actor->company_id);
    }

    /* ------------------------------------------------------------ team view */

    public function leaderboard(User $actor, string $month): array
    {
        $period = $this->period($month);

        $employees = Employee::query()
            ->visibleTo($actor)
            ->where('employment_status', '!=', Employee::EMPLOYMENT_EXITED)
            ->with('user:id,name')
            ->get(['id', 'company_id', 'employee_code', 'user_id', 'work_shift_id']);

        $rows = [];

        foreach ($employees as $employee) {
            $score = $this->find($employee, $period) ?? $this->snapshot($employee, $period, $actor);

            $rows[] = [
                'employee_id' => (int) $employee->id,
                'employee_code' => $employee->employee_code,
                'name' => $employee->user?->name,
                'score' => (int) $score->score,
                'goal_score' => $score->goal_score,
                'on_time_percent' => $score->on_time_percent,
                'report_compliance_percent' => $score->report_compliance_percent,
                'tasks_done' => (int) $score->tasks_done,
                'tasks_overdue' => (int) $score->tasks_overdue,
                'is_frozen' => $score->isFrozen(),
            ];
        }

        usort($rows, fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        foreach ($rows as $index => $row) {
            $rows[$index]['rank'] = $index + 1;
        }

        return [
            'month' => $period->format('Y-m'),
            'headcount' => count($rows),
            'average_score' => $rows === [] ? null : (int) round(array_sum(array_column($rows, 'score')) / count($rows)),
            'employees' => $rows,
        ];
    }

    /* --------------------------------------------------------------- guards */

    private function find(Employee $employee, Carbon $period): ?PerformanceScore
    {
        return PerformanceScore::query()
            ->where('employee_id', $employee->id)
            ->whereDate('period_month', $period->copy()->startOfMonth()->toDateString())
            ->first();
    }

    private function present(PerformanceScore $score, Employee $employee, bool $fromFreeze): array
    {
        return [
            'employee_id' => (int) $employee->id,
            'employee_code' => $employee->employee_code,
            'employee_name' => $employee->user?->name,
            'month' => $score->period_month->format('Y-m'),
            'score' => (int) $score->score,
            'goal_score' => $score->goal_score,
            'breakdown' => [
                'delivery' => (int) $score->delivery_score,
                'discipline' => (int) $score->discipline_score,
                'penalty' => (int) $score->penalty,
            ],
            'tasks' => [
                'assigned' => (int) $score->tasks_assigned,
                'done' => (int) $score->tasks_done,
                'overdue' => (int) $score->tasks_overdue,
                'on_time_percent' => $score->on_time_percent,
            ],
            'reports' => [
                'expected' => (int) $score->report_expected,
                'completed' => (int) $score->report_completed,
                'compliance_percent' => $score->report_compliance_percent,
            ],
            'attendance' => [
                'present' => (int) $score->present_days,
                'absent' => (int) $score->absent_days,
                'late' => (int) $score->late_days,
                'leave_days' => (float) $score->leave_days,
            ],
            'hours_logged' => (float) $score->hours_logged,
            'is_frozen' => $fromFreeze || $score->isFrozen(),
            'computed_at' => $score->computed_at,
        ];
    }

    private function period(string $month): Carbon
    {
        try {
            return Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfMonth();
        } catch (\Throwable) {
            throw new ApiException('Month YYYY-MM format mein do.', 422, 'PERFORMANCE_MONTH_INVALID');
        }
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        $query = Employee::query()->with('user');

        if ($employeeId === null) {
            $employee = $query->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Performance ke liye employee record chahiye. HR se onboarding karwao.',
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

    private function assertPermission(User $actor, string $permission, string $what): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission($permission)) {
            return;
        }

        throw new ApiException('Aapke paas ' . $what . ' ka haq nahi hai.', 403, 'FORBIDDEN');
    }
}

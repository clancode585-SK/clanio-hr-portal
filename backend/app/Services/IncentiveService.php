<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\IncentiveRecord;
use App\Models\IncentiveRule;
use App\Models\IncentiveSlab;
use App\Models\PerformanceGoal;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class IncentiveService
{
    public function __construct(private readonly NotificationService $notifications) {}

    /* ----------------------------------------------------------------- rules */

    public function rules(User $actor): array
    {
        return IncentiveRule::query()
            ->with('slabs', 'role')
            ->orderByRaw('role_id IS NULL DESC')
            ->orderBy('name')
            ->get()
            ->all();
    }

    public function createRule(array $data, User $actor, ?int $companyId): IncentiveRule
    {
        $this->assertPermission($actor, IncentiveRule::MANAGE_PERMISSION, 'incentive rule banane');

        if ($companyId === null) {
            throw new ApiException('Rule company ka hota hai. X-Company-Id bhejo.', 422, 'TENANT_REQUIRED');
        }

        return DB::transaction(function () use ($data, $actor, $companyId): IncentiveRule {
            $rule = new IncentiveRule($data);
            $rule->company_id = $companyId;
            $rule->created_by = $actor->id;
            $rule->save();

            $this->replaceSlabs($rule, $data['slabs'] ?? $this->defaultSlabs());
            $this->flush();

            return $rule->refresh()->load('slabs', 'role');
        });
    }

    public function updateRule(IncentiveRule $rule, array $data, User $actor): IncentiveRule
    {
        $this->assertPermission($actor, IncentiveRule::MANAGE_PERMISSION, 'incentive rule badalne');

        return DB::transaction(function () use ($rule, $data, $actor): IncentiveRule {
            $rule->fill($data);
            $rule->updated_by = $actor->id;
            $rule->save();

            if (isset($data['slabs'])) {
                $this->replaceSlabs($rule, $data['slabs']);
            }

            $this->flush();

            return $rule->refresh()->load('slabs', 'role');
        });
    }

    public function deleteRule(IncentiveRule $rule, User $actor): void
    {
        $this->assertPermission($actor, IncentiveRule::MANAGE_PERMISSION, 'incentive rule hataane');

        $rule->deactivate();
        $this->flush();
    }

    /* ----------------------------------------------------------- calculation */

    /**
     * Us period ke saare finalised OKR ka weighted achievement nikalta hai,
     * phir slab dekhkar incentive % bana deta hai. Rupaye payroll banayega.
     */
    public function calculate(Employee $employee, string $periodType, string $periodLabel, ?User $actor = null): IncentiveRecord
    {
        [$start, $end] = $this->periodRange($periodType, $periodLabel);

        $goals = PerformanceGoal::query()
            ->where('employee_id', $employee->id)
            ->where('period_type', $periodType)
            ->where('period_label', $periodLabel)
            ->where('verification_status', PerformanceGoal::FINALISED)
            ->whereNull('parent_id')
            ->get(['id', 'weight', 'achievement_percent']);

        $achievement = $this->weightedAchievement($goals);
        $rule = $this->ruleFor($employee, $periodType);
        $slab = $rule?->slabFor($achievement);

        $base = (float) ($rule->base_percent ?? 0);
        $factor = (int) ($slab->payout_factor ?? 0);
        $incentive = round($base * $factor / 100, 2);

        $record = IncentiveRecord::query()
            ->where('employee_id', $employee->id)
            ->where('period_type', $periodType)
            ->where('period_label', $periodLabel)
            ->first();

        if ($record !== null && $record->isApproved()) {
            throw new ApiException(
                'Ye incentive approve ho chuka hai, dobara calculate nahi hoga.',
                409,
                'INCENTIVE_ALREADY_APPROVED'
            );
        }

        $record ??= new IncentiveRecord();

        $record->company_id = $employee->company_id;
        $record->employee_id = $employee->id;

        $record->forceFill([
            'incentive_rule_id' => $rule?->id,
            'period_type' => $periodType,
            'period_label' => $periodLabel,
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'goal_count' => $goals->count(),
            'achievement_percent' => $achievement,
            'base_percent' => $base,
            'payout_factor' => $factor,
            'incentive_percent' => $incentive,
            'slab_label' => $slab->label ?? null,
            'status' => IncentiveRecord::CALCULATED,
            'calculated_at' => Carbon::now(),
            'updated_by' => $actor?->id,
        ]);

        if ($record->created_by === null) {
            $record->created_by = $actor?->id;
        }

        $record->save();
        $this->flush();

        return $record->refresh()->load('employee.user', 'rule');
    }

    public function calculateCompany(int $companyId, string $periodType, string $periodLabel, ?User $actor = null): int
    {
        $employees = Employee::query()
            ->where('company_id', $companyId)
            ->where('employment_status', '!=', Employee::EMPLOYMENT_EXITED)
            ->get(['id', 'company_id', 'user_id']);

        $count = 0;

        foreach ($employees as $employee) {
            $existing = IncentiveRecord::query()
                ->where('employee_id', $employee->id)
                ->where('period_type', $periodType)
                ->where('period_label', $periodLabel)
                ->first();

            if ($existing !== null && $existing->isApproved()) {
                continue;
            }

            $this->calculate($employee, $periodType, $periodLabel, $actor);
            $count++;
        }

        return $count;
    }

    public function approve(IncentiveRecord $record, array $data, User $actor): IncentiveRecord
    {
        $this->assertPermission($actor, IncentiveRule::APPROVE_PERMISSION, 'incentive approve karne');

        if ($record->isApproved()) {
            throw new ApiException('Ye already approve ho chuka hai.', 409, 'INCENTIVE_ALREADY_APPROVED');
        }

        $record->forceFill([
            'status' => IncentiveRecord::APPROVED,
            'approved_by' => $actor->id,
            'approved_at' => Carbon::now(),
            'remarks' => $data['remarks'] ?? null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $record = $record->refresh()->load('employee.user', 'rule', 'approver');

        $this->notifyEmployee($record, $actor);

        return $record;
    }

    public function reject(IncentiveRecord $record, array $data, User $actor): IncentiveRecord
    {
        $this->assertPermission($actor, IncentiveRule::APPROVE_PERMISSION, 'incentive reject karne');

        if ($record->isApproved()) {
            throw new ApiException('Approve hone ke baad reject nahi hota.', 409, 'INCENTIVE_ALREADY_APPROVED');
        }

        $record->forceFill([
            'status' => IncentiveRecord::REJECTED,
            'approved_by' => $actor->id,
            'approved_at' => Carbon::now(),
            'remarks' => $data['reason'],
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $record->refresh()->load('employee.user', 'rule', 'approver');
    }

    public function summary(User $actor, string $periodType, string $periodLabel): array
    {
        $this->assertPermission($actor, IncentiveRule::APPROVE_PERMISSION, 'incentive summary dekhne');

        $row = DB::table('incentive_records')
            ->where('company_id', $actor->company_id)
            ->where('period_type', $periodType)
            ->where('period_label', $periodLabel)
            ->where('is_active', 1)
            ->selectRaw("
                COUNT(*) as total,
                SUM(status = 'calculated') as pending,
                SUM(status = 'approved') as approved,
                SUM(status = 'rejected') as rejected,
                COALESCE(AVG(achievement_percent), 0) as avg_achievement,
                COALESCE(SUM(CASE WHEN status = 'approved' THEN incentive_percent ELSE 0 END), 0) as approved_percent_total
            ")
            ->first();

        return [
            'period_type' => $periodType,
            'period_label' => $periodLabel,
            'total' => (int) $row->total,
            'pending' => (int) $row->pending,
            'approved' => (int) $row->approved,
            'rejected' => (int) $row->rejected,
            'average_achievement' => (int) round((float) $row->avg_achievement),
            'approved_percent_total' => round((float) $row->approved_percent_total, 2),
        ];
    }

    /* --------------------------------------------------------------- helpers */

    private function weightedAchievement($goals): int
    {
        if ($goals->isEmpty()) {
            return 0;
        }

        $totalWeight = (int) $goals->sum('weight');

        if ($totalWeight === 0) {
            return $this->clamp((int) round($goals->avg('achievement_percent')));
        }

        $weighted = 0.0;

        foreach ($goals as $goal) {
            $weighted += (int) $goal->achievement_percent * (int) $goal->weight;
        }

        return $this->clamp((int) round($weighted / $totalWeight));
    }

    /** Role ka apna rule ho to wahi, warna company ka default (role_id NULL). */
    private function ruleFor(Employee $employee, string $periodType): ?IncentiveRule
    {
        $roleIds = DB::table('user_roles')->where('user_id', $employee->user_id)->pluck('role_id')->all();

        $rule = IncentiveRule::query()
            ->with('slabs')
            ->where('company_id', $employee->company_id)
            ->where('period_type', $periodType)
            ->whereIn('role_id', $roleIds === [] ? [0] : $roleIds)
            ->first();

        return $rule ?? IncentiveRule::query()
            ->with('slabs')
            ->where('company_id', $employee->company_id)
            ->where('period_type', $periodType)
            ->whereNull('role_id')
            ->first();
    }

    /** @return array{0: Carbon, 1: Carbon} */
    public function periodRange(string $periodType, string $label): array
    {
        try {
            return match ($periodType) {
                PerformanceGoal::PERIOD_MONTH => [
                    Carbon::createFromFormat('Y-m-d', $label . '-01')->startOfMonth(),
                    Carbon::createFromFormat('Y-m-d', $label . '-01')->endOfMonth(),
                ],
                PerformanceGoal::PERIOD_QUARTER, PerformanceGoal::PERIOD_ANNUAL,
                PerformanceGoal::PERIOD_WEEK, PerformanceGoal::PERIOD_FORTNIGHT => [
                    Carbon::parse(explode('..', $label)[0]),
                    Carbon::parse(explode('..', $label)[1] ?? explode('..', $label)[0]),
                ],
                default => throw new ApiException('Period type galat hai.', 422, 'PERIOD_INVALID'),
            };
        } catch (ApiException $e) {
            throw $e;
        } catch (\Throwable) {
            throw new ApiException(
                'Period label galat hai. Month ke liye YYYY-MM, baaki ke liye YYYY-MM-DD..YYYY-MM-DD.',
                422,
                'PERIOD_INVALID'
            );
        }
    }

    private function replaceSlabs(IncentiveRule $rule, array $slabs): void
    {
        $this->assertSlabs($slabs);

        IncentiveSlab::query()->where('incentive_rule_id', $rule->id)->delete();

        $now = Carbon::now();
        $rows = [];

        foreach ($slabs as $slab) {
            $rows[] = [
                'company_id' => $rule->company_id,
                'incentive_rule_id' => $rule->id,
                'from_percent' => (int) $slab['from_percent'],
                'to_percent' => (int) $slab['to_percent'],
                'payout_factor' => (int) $slab['payout_factor'],
                'label' => $slab['label'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($rows !== []) {
            IncentiveSlab::query()->insert($rows);
        }
    }

    private function assertSlabs(array $slabs): void
    {
        $sorted = collect($slabs)->sortBy('from_percent')->values();
        $previousTo = null;

        foreach ($sorted as $slab) {
            $from = (int) $slab['from_percent'];
            $to = (int) $slab['to_percent'];

            if ($to < $from) {
                throw new ApiException(
                    'Slab galat hai — ' . $from . ' se ' . $to . ' nahi ho sakta.',
                    422,
                    'SLAB_INVALID'
                );
            }

            if ($previousTo !== null && $from <= $previousTo) {
                throw new ApiException(
                    'Slab aapas me overlap kar rahe hain (' . $from . ' pehle wale ke andar hai).',
                    422,
                    'SLAB_OVERLAP'
                );
            }

            $previousTo = $to;
        }
    }

    private function defaultSlabs(): array
    {
        return [
            ['from_percent' => 0, 'to_percent' => 69, 'payout_factor' => 0, 'label' => 'Target se bahut peeche'],
            ['from_percent' => 70, 'to_percent' => 89, 'payout_factor' => 50, 'label' => 'Aadha incentive'],
            ['from_percent' => 90, 'to_percent' => 100, 'payout_factor' => 100, 'label' => 'Pura incentive'],
            ['from_percent' => 101, 'to_percent' => 999, 'payout_factor' => 120, 'label' => 'Target se upar, bonus'],
        ];
    }

    private function clamp(int $value): int
    {
        return max(0, min(999, $value));
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
        TenantCache::flush(TenantCache::PERFORMANCE);
    }

    private function notifyEmployee(IncentiveRecord $record, User $actor): void
    {
        $userId = (int) ($record->employee->user_id ?? 0);

        if ($userId === 0 || $userId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($userId, [
            'type' => NotificationType::INCENTIVE_APPROVED,
            'title' => $record->period_label . ' ka incentive approve ho gaya',
            'body' => 'Achievement ' . $record->achievement_percent . '% · incentive '
                . $record->incentive_percent . '% (' . ($record->slab_label ?? '-') . ')',
            'action_url' => '/incentives',
            'entity_type' => 'incentive_record',
            'entity_id' => $record->id,
            'payload' => [
                'period' => $record->period_label,
                'achievement_percent' => $record->achievement_percent,
                'incentive_percent' => $record->incentive_percent,
            ],
            'dedupe_key' => 'incentive:' . $record->id . ':approved',
        ]);
    }
}

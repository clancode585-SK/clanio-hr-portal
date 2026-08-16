<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Appraisal;
use App\Models\AppraisalCycle;
use App\Models\Employee;
use App\Models\PerformanceScore;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Recipients;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AppraisalService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly PerformanceService $performance,
        private readonly GoalService $goals
    ) {}

    /* ---------------------------------------------------------------- cycle */

    public function createCycle(User $actor, array $data): AppraisalCycle
    {
        $this->assertPermission($actor, AppraisalCycle::MANAGE_PERMISSION, 'appraisal cycle banane');

        $start = Carbon::parse($data['period_start'])->startOfDay();
        $end = Carbon::parse($data['period_end'])->startOfDay();

        if ($end->lessThan($start)) {
            throw new ApiException('Period end, start se pehle nahi ho sakta.', 422, 'CYCLE_DATE_INVALID');
        }

        $cycle = new AppraisalCycle([
            'name' => $data['name'],
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'self_review_due' => $data['self_review_due'] ?? null,
            'manager_review_due' => $data['manager_review_due'] ?? null,
            'rating_scale' => (int) ($data['rating_scale'] ?? 5),
        ]);

        $cycle->company_id = $actor->company_id;
        $cycle->created_by = $actor->id;
        $cycle->save();

        $this->flush();

        return $cycle->refresh();
    }

    public function updateCycle(AppraisalCycle $cycle, array $data, User $actor): AppraisalCycle
    {
        $this->assertPermission($actor, AppraisalCycle::MANAGE_PERMISSION, 'cycle badalne');

        if (! $cycle->isDraft()) {
            throw new ApiException('Launch hone ke baad cycle edit nahi hoti.', 409, 'CYCLE_LAUNCHED');
        }

        $cycle->fill($data);
        $cycle->updated_by = $actor->id;
        $cycle->save();

        $this->flush();

        return $cycle->refresh();
    }

    /**
     * Launch par har active employee ka appraisal ban jata hai aur us period ka
     * score + goal achievement usmein bhar diya jata hai.
     */
    public function launch(AppraisalCycle $cycle, User $actor): AppraisalCycle
    {
        $this->assertPermission($actor, AppraisalCycle::MANAGE_PERMISSION, 'cycle launch karne');

        if (! $cycle->isDraft()) {
            throw new ApiException('Ye cycle already launch ho chuki hai.', 409, 'CYCLE_LAUNCHED');
        }

        $created = DB::transaction(function () use ($cycle, $actor): int {
            $employees = Employee::query()
                ->where('employment_status', '!=', Employee::EMPLOYMENT_EXITED)
                ->with('user:id,name')
                ->get(['id', 'company_id', 'user_id', 'employee_code', 'reporting_manager_id', 'work_shift_id']);

            $count = 0;

            foreach ($employees as $employee) {
                $appraisal = new Appraisal();
                $appraisal->company_id = $cycle->company_id;
                $appraisal->appraisal_cycle_id = $cycle->id;
                $appraisal->employee_id = $employee->id;
                $appraisal->manager_id = $employee->reporting_manager_id;
                $appraisal->auto_score = $this->periodScore($employee, $cycle);
                $appraisal->goal_achievement_percent = $this->goals->achievement(
                    $employee,
                    $cycle->period_start,
                    $cycle->period_end
                );
                $appraisal->created_by = $actor->id;
                $appraisal->save();

                $count++;
            }

            $cycle->forceFill([
                'status' => AppraisalCycle::SELF_REVIEW,
                'launched_at' => Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();

            return $count;
        });

        $this->notifyLaunched($cycle, $created, $actor);

        return $cycle->refresh();
    }

    public function advanceCycle(AppraisalCycle $cycle, string $status, User $actor): AppraisalCycle
    {
        $this->assertPermission($actor, AppraisalCycle::MANAGE_PERMISSION, 'cycle aage badhane');

        $order = [
            AppraisalCycle::SELF_REVIEW,
            AppraisalCycle::MANAGER_REVIEW,
            AppraisalCycle::HR_REVIEW,
            AppraisalCycle::CLOSED,
        ];

        if ($cycle->isDraft()) {
            throw new ApiException('Pehle cycle launch karo.', 409, 'CYCLE_NOT_LAUNCHED');
        }

        $current = array_search($cycle->status, $order, true);
        $next = array_search($status, $order, true);

        if ($next === false || $current === false || $next <= $current) {
            throw new ApiException('Cycle sirf aage badh sakti hai, peeche nahi.', 422, 'CYCLE_STAGE_INVALID');
        }

        $cycle->forceFill([
            'status' => $status,
            'closed_at' => $status === AppraisalCycle::CLOSED ? Carbon::now() : null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $cycle->refresh();
    }

    /* ------------------------------------------------------------ appraisal */

    public function selfReview(Appraisal $appraisal, array $data, User $actor): Appraisal
    {
        $this->assertOwner($appraisal, $actor);
        $this->assertCycleStage($appraisal, AppraisalCycle::SELF_REVIEW);

        if (! $appraisal->isPending()) {
            throw new ApiException('Self review already ho chuka hai.', 409, 'APPRAISAL_WRONG_STAGE');
        }

        $this->assertRating($appraisal, (float) $data['rating']);

        $appraisal->forceFill([
            'status' => Appraisal::SELF_DONE,
            'self_rating' => $data['rating'],
            'self_comments' => $data['comments'] ?? null,
            'self_submitted_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $appraisal = $appraisal->refresh()->load('employee.user', 'cycle');

        $this->notifyManager($appraisal, $actor);

        return $appraisal;
    }

    public function managerReview(Appraisal $appraisal, array $data, User $actor): Appraisal
    {
        $this->assertManager($appraisal, $actor);
        $this->assertCycleStage($appraisal, AppraisalCycle::MANAGER_REVIEW);

        if (! $appraisal->isSelfDone()) {
            throw new ApiException(
                $appraisal->isPending()
                    ? 'Pehle employee self review bharega.'
                    : 'Manager review already ho chuka hai.',
                409,
                'APPRAISAL_WRONG_STAGE'
            );
        }

        $this->assertRating($appraisal, (float) $data['rating']);

        $appraisal->forceFill([
            'status' => Appraisal::MANAGER_DONE,
            'manager_rating' => $data['rating'],
            'manager_comments' => $data['comments'] ?? null,
            'manager_submitted_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $appraisal = $appraisal->refresh()->load('employee.user', 'cycle', 'manager');

        $this->notifyHr($appraisal, $actor);

        return $appraisal;
    }

    public function finalise(Appraisal $appraisal, array $data, User $actor): Appraisal
    {
        $this->assertPermission($actor, AppraisalCycle::FINALISE_PERMISSION, 'final rating dene');

        if (! $appraisal->isManagerDone()) {
            throw new ApiException(
                'Pehle manager review complete hoga, tab final rating milegi.',
                409,
                'APPRAISAL_WRONG_STAGE'
            );
        }

        $this->assertRating($appraisal, (float) $data['rating']);

        $appraisal->forceFill([
            'status' => Appraisal::FINALISED,
            'final_rating' => $data['rating'],
            'final_comments' => $data['comments'] ?? null,
            'hr_id' => $actor->id,
            'finalised_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $appraisal = $appraisal->refresh()->load('employee.user', 'cycle', 'manager', 'hr');

        $this->notifyEmployee($appraisal, $actor);

        return $appraisal;
    }

    /* -------------------------------------------------------------- summary */

    public function cycleSummary(AppraisalCycle $cycle, User $actor): array
    {
        $this->assertPermission($actor, AppraisalCycle::MANAGE_PERMISSION, 'cycle summary dekhne');

        $counts = DB::table('appraisals')
            ->where('appraisal_cycle_id', $cycle->id)
            ->where('is_active', 1)
            ->selectRaw("
                COUNT(*) as total,
                SUM(status = 'pending') as pending_self,
                SUM(status = 'self_done') as pending_manager,
                SUM(status = 'manager_done') as pending_hr,
                SUM(status = 'finalised') as finalised,
                AVG(final_rating) as avg_final,
                AVG(auto_score) as avg_auto
            ")
            ->first();

        $distribution = DB::table('appraisals')
            ->where('appraisal_cycle_id', $cycle->id)
            ->where('is_active', 1)
            ->whereNotNull('final_rating')
            ->groupBy('final_rating')
            ->orderBy('final_rating')
            ->get([DB::raw('final_rating as rating'), DB::raw('COUNT(*) as employees')])
            ->map(fn ($row): array => [
                'rating' => (float) $row->rating,
                'employees' => (int) $row->employees,
            ])
            ->all();

        return [
            'cycle' => [
                'uuid' => $cycle->uuid,
                'name' => $cycle->name,
                'status' => $cycle->status,
                'stage' => $cycle->stageLabel(),
                'period_start' => $cycle->period_start->format('Y-m-d'),
                'period_end' => $cycle->period_end->format('Y-m-d'),
                'rating_scale' => (int) $cycle->rating_scale,
            ],
            'counts' => [
                'total' => (int) $counts->total,
                'pending_self' => (int) $counts->pending_self,
                'pending_manager' => (int) $counts->pending_manager,
                'pending_hr' => (int) $counts->pending_hr,
                'finalised' => (int) $counts->finalised,
            ],
            'average_final_rating' => $counts->avg_final === null ? null : round((float) $counts->avg_final, 2),
            'average_auto_score' => $counts->avg_auto === null ? null : (int) round((float) $counts->avg_auto),
            'rating_distribution' => $distribution,
        ];
    }

    /* --------------------------------------------------------------- guards */

    /** Cycle ke poore period ka average monthly score. */
    private function periodScore(Employee $employee, AppraisalCycle $cycle): ?int
    {
        $period = $cycle->period_start->copy()->startOfMonth();
        $last = $cycle->period_end->copy()->startOfMonth();
        $today = Carbon::today()->startOfMonth();
        $scores = [];

        while ($period->lessThanOrEqualTo($last)) {
            if ($period->lessThanOrEqualTo($today)) {
                $scores[] = (int) $this->performance->snapshot($employee, $period)->score;
            }

            $period->addMonth();
        }

        if ($scores === []) {
            return null;
        }

        return (int) round(array_sum($scores) / count($scores));
    }

    private function assertRating(Appraisal $appraisal, float $rating): void
    {
        $scale = (int) ($appraisal->cycle?->rating_scale ?? 5);

        if ($rating < 1 || $rating > $scale) {
            throw new ApiException(
                'Rating 1 se ' . $scale . ' ke beech honi chahiye.',
                422,
                'APPRAISAL_RATING_INVALID'
            );
        }
    }

    private function assertCycleStage(Appraisal $appraisal, string $stage): void
    {
        $cycle = $appraisal->cycle;

        if ($cycle === null) {
            throw new ApiException('Cycle nahi mili.', 404, 'NOT_FOUND');
        }

        if ($cycle->isClosed()) {
            throw new ApiException('Ye cycle band ho chuki hai.', 409, 'CYCLE_CLOSED');
        }

        if ($cycle->status !== $stage) {
            throw new ApiException(
                'Abhi cycle ' . $cycle->stageLabel() . ' — ye step abhi nahi hoga.',
                409,
                'CYCLE_STAGE_INVALID'
            );
        }
    }

    private function assertOwner(Appraisal $appraisal, User $actor): void
    {
        if ((int) $appraisal->employee->user_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Ye appraisal aapki nahi hai.', 403, 'FORBIDDEN');
    }

    private function assertManager(Appraisal $appraisal, User $actor): void
    {
        if ((int) $appraisal->employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Apna review khud nahi kar sakte.', 403, 'APPRAISAL_SELF_REVIEW');
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(AppraisalCycle::MANAGE_PERMISSION)) {
            return;
        }

        if ((int) $appraisal->manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Aap is appraisal ke manager nahi hain.', 403, 'FORBIDDEN');
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

    /* -------------------------------------------------------- notifications */

    private function notifyLaunched(AppraisalCycle $cycle, int $created, User $actor): void
    {
        $recipients = Recipients::except(
            Recipients::activeUsers((int) $cycle->company_id),
            [(int) $actor->id]
        );

        if ($recipients === [] || $created === 0) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::APPRAISAL_LAUNCHED,
            'title' => $cycle->name . ' appraisal shuru ho gaya',
            'body' => 'Self review bharna hai' . ($cycle->self_review_due === null
                ? '.'
                : ' — last date ' . $cycle->self_review_due->format('d M Y') . '.'),
            'action_url' => '/appraisals',
            'entity_type' => 'appraisal_cycle',
            'entity_id' => $cycle->id,
            'payload' => ['cycle_id' => $cycle->id, 'appraisals' => $created],
            'dedupe_key' => 'appraisal-cycle:' . $cycle->id . ':launched',
        ], $actor);
    }

    private function notifyManager(Appraisal $appraisal, User $actor): void
    {
        $managerId = (int) ($appraisal->manager_id ?? 0);

        if ($managerId === 0 || $managerId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($managerId, [
            'type' => NotificationType::APPRAISAL_MANAGER_PENDING,
            'title' => $this->employeeName($appraisal) . ' ka self review aa gaya',
            'body' => 'Aapko review karna hai.',
            'action_url' => '/appraisals/' . $appraisal->uuid,
            'entity_type' => 'appraisal',
            'entity_id' => $appraisal->id,
            'payload' => ['appraisal_id' => $appraisal->id],
            'dedupe_key' => 'appraisal:' . $appraisal->id . ':manager',
        ]);
    }

    private function notifyHr(Appraisal $appraisal, User $actor): void
    {
        $recipients = Recipients::except(
            Recipients::withPermission((int) $appraisal->company_id, AppraisalCycle::FINALISE_PERMISSION),
            [(int) $actor->id, (int) $appraisal->employee->user_id]
        );

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::APPRAISAL_HR_PENDING,
            'title' => $this->employeeName($appraisal) . ' ki final rating pending',
            'body' => 'Manager rating ' . $appraisal->manager_rating . ' di hai.',
            'action_url' => '/appraisals/' . $appraisal->uuid,
            'entity_type' => 'appraisal',
            'entity_id' => $appraisal->id,
            'payload' => ['appraisal_id' => $appraisal->id],
            'dedupe_key' => 'appraisal:' . $appraisal->id . ':hr',
        ], $actor);
    }

    private function notifyEmployee(Appraisal $appraisal, User $actor): void
    {
        $userId = (int) ($appraisal->employee->user_id ?? 0);

        if ($userId === 0 || $userId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($userId, [
            'type' => NotificationType::APPRAISAL_FINALISED,
            'title' => 'Aapka appraisal final ho gaya',
            'body' => 'Final rating ' . $appraisal->final_rating . ' / ' . $appraisal->cycle?->rating_scale,
            'action_url' => '/appraisals/' . $appraisal->uuid,
            'entity_type' => 'appraisal',
            'entity_id' => $appraisal->id,
            'payload' => ['appraisal_id' => $appraisal->id, 'rating' => $appraisal->final_rating],
            'dedupe_key' => 'appraisal:' . $appraisal->id . ':finalised',
        ]);
    }

    private function employeeName(Appraisal $appraisal): string
    {
        return $appraisal->employee->user?->name ?? $appraisal->employee->employee_code;
    }
}

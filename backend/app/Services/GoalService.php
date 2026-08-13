<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AppraisalCycle;
use App\Models\Employee;
use App\Models\PerformanceGoal;
use App\Models\Task;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Recipients;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class GoalService
{
    public function __construct(private readonly NotificationService $notifications) {}

    /* ----------------------------------------------------------------- CRUD */

    public function create(User $actor, array $data): PerformanceGoal
    {
        $employee = $this->employeeFor($actor, isset($data['employee_id']) ? (int) $data['employee_id'] : null);
        $type = $data['goal_type'] ?? PerformanceGoal::TYPE_KRA;
        $parent = $this->parentFor($data, $type, $employee);

        $this->assertShape($type, $data, $parent);

        $goal = DB::transaction(function () use ($employee, $data, $type, $parent, $actor): PerformanceGoal {
            $goal = new PerformanceGoal([
                'appraisal_cycle_id' => $parent?->appraisal_cycle_id ?? ($data['appraisal_cycle_id'] ?? null),
                'parent_id' => $parent?->id,
                'goal_type' => $type,
                'period_type' => $data['period_type'] ?? $parent?->period_type ?? PerformanceGoal::PERIOD_QUARTER,
                'period_label' => $data['period_label'] ?? $parent?->period_label,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'metric' => $data['metric'] ?? null,
                'target_value' => $data['target_value'] ?? null,
                'weight' => (int) ($data['weight'] ?? 0),
                'start_date' => $data['start_date'],
                'due_date' => $data['due_date'],
                'progress_source' => $data['progress_source'] ?? PerformanceGoal::SOURCE_MANUAL,
            ]);

            $goal->company_id = $employee->company_id;
            $goal->employee_id = $employee->id;
            $goal->created_by = $actor->id;
            $goal->save();

            if (isset($data['task_ids'])) {
                $this->attachTasks($goal, $data['task_ids']);
            }

            $this->assertWeights($goal);
            $this->refreshProgress($goal);
            $this->flush();

            return $goal->refresh()->load('employee.user', 'keyResults');
        });

        $this->notifyApprover($goal, $actor);

        return $goal;
    }

    public function update(PerformanceGoal $goal, array $data, User $actor): PerformanceGoal
    {
        $this->assertOwnerOrManager($goal, $actor);

        if ($goal->isClosed()) {
            throw new ApiException('Band goal edit nahi hoti.', 409, 'GOAL_CLOSED');
        }

        return DB::transaction(function () use ($goal, $data, $actor): PerformanceGoal {
            $goal->fill($data);
            $goal->updated_by = $actor->id;
            $goal->save();

            if (isset($data['task_ids'])) {
                $goal->tasks()->detach();
                $this->attachTasks($goal, $data['task_ids']);
            }

            $this->assertWeights($goal);
            $this->refreshProgress($goal);
            $this->flush();

            return $goal->refresh()->load('employee.user', 'keyResults', 'tasks');
        });
    }

    public function approve(PerformanceGoal $goal, User $actor): PerformanceGoal
    {
        $this->assertCanApprove($goal, $actor);

        if (! $goal->isDraft()) {
            throw new ApiException('Ye goal already ' . $goal->status . ' hai.', 409, 'GOAL_WRONG_STAGE');
        }

        $goal->forceFill([
            'status' => PerformanceGoal::ACTIVE,
            'approved_by' => $actor->id,
            'approved_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $goal->keyResults()->where('status', PerformanceGoal::DRAFT)->update([
            'status' => PerformanceGoal::ACTIVE,
            'approved_by' => $actor->id,
            'approved_at' => Carbon::now(),
        ]);

        $this->flush();
        $goal = $goal->refresh()->load('employee.user', 'keyResults');

        $this->notifyEmployee($goal, $actor, NotificationType::GOAL_APPROVED,
            'Goal approve ho gaya',
            $goal->title . ' — ab ye track hoga.');

        return $goal;
    }

    public function updateProgress(PerformanceGoal $goal, array $data, User $actor): PerformanceGoal
    {
        $this->assertOwnerOrManager($goal, $actor);

        if ($goal->isObjective()) {
            throw new ApiException(
                'Objective ka progress khud nahi lagta — key results se banta hai.',
                409,
                'GOAL_PROGRESS_DERIVED'
            );
        }

        if ($goal->isClosed()) {
            throw new ApiException('Band goal ka progress nahi badalta.', 409, 'GOAL_CLOSED');
        }

        if ($goal->tracksTasks()) {
            throw new ApiException(
                'Is goal ka progress linked tasks se banta hai, manually nahi.',
                409,
                'GOAL_PROGRESS_DERIVED'
            );
        }

        $goal->forceFill([
            'achieved_value' => $data['achieved_value'] ?? $goal->achieved_value,
            'progress_percent' => isset($data['progress_percent'])
                ? $this->clamp((int) $data['progress_percent'])
                : $goal->progress_percent,
            'updated_by' => $actor->id,
        ])->save();

        $this->refreshProgress($goal);
        $this->flush();

        return $goal->refresh()->load('employee.user', 'keyResults');
    }

    /* --------------------------------------------------- OKR verification */

    public function submit(PerformanceGoal $goal, array $data, User $actor): PerformanceGoal
    {
        $this->assertOwner($goal, $actor);

        if (! $goal->isActive()) {
            throw new ApiException(
                'Sirf active goal submit hota hai — abhi ' . $goal->status . '.',
                409,
                'GOAL_WRONG_STAGE'
            );
        }

        if ($goal->isFinalised()) {
            throw new ApiException('Ye already final ho chuka hai.', 409, 'OKR_ALREADY_FINALISED');
        }

        $value = (float) $data['achieved_value'];

        $goal->forceFill([
            'verification_status' => PerformanceGoal::SUBMITTED,
            'submitted_value' => $value,
            'submitted_at' => Carbon::now(),
            'achieved_value' => $value,
            'updated_by' => $actor->id,
        ])->save();

        $this->refreshProgress($goal);
        $this->flush();

        $goal = $goal->refresh()->load('employee.user');
        $this->notifyVerifier($goal, $actor);

        return $goal;
    }

    public function verify(PerformanceGoal $goal, array $data, User $actor): PerformanceGoal
    {
        $this->assertCanVerify($goal, $actor);

        if (! $goal->isSubmitted()) {
            throw new ApiException(
                'Pehle employee submit karega — abhi ' . $goal->verificationLabel() . '.',
                409,
                'OKR_WRONG_STAGE'
            );
        }

        $value = isset($data['achieved_value'])
            ? (float) $data['achieved_value']
            : (float) $goal->submitted_value;

        $goal->forceFill([
            'verification_status' => PerformanceGoal::MANAGER_VERIFIED,
            'manager_value' => $value,
            'manager_verified_by' => $actor->id,
            'manager_verified_at' => Carbon::now(),
            'manager_remarks' => $data['remarks'] ?? null,
            'achieved_value' => $value,
            'updated_by' => $actor->id,
        ])->save();

        $this->refreshProgress($goal);
        $this->flush();

        $goal = $goal->refresh()->load('employee.user');

        $this->notifyEmployee($goal, $actor, NotificationType::OKR_VERIFIED,
            'Manager ne aapka OKR verify kar diya',
            $goal->title . ' — ab HR final karegi.');
        $this->notifyHr($goal, $actor);

        return $goal;
    }

    /**
     * HR final karti hai — yahan achievement % lock ho jata hai, phir koi nahi badal sakta.
     */
    public function finalise(PerformanceGoal $goal, array $data, User $actor): PerformanceGoal
    {
        $this->assertPermission($actor, PerformanceGoal::VERIFY_PERMISSION, 'OKR final karne');

        if (! $goal->isManagerVerified()) {
            throw new ApiException(
                'Pehle manager verify karega — abhi ' . $goal->verificationLabel() . '.',
                409,
                'OKR_WRONG_STAGE'
            );
        }

        $value = isset($data['achieved_value'])
            ? (float) $data['achieved_value']
            : (float) $goal->manager_value;

        $goal->forceFill([
            'verification_status' => PerformanceGoal::FINALISED,
            'final_value' => $value,
            'achieved_value' => $value,
            'achievement_percent' => $this->achievementPercent($goal, $value),
            'hr_verified_by' => $actor->id,
            'hr_verified_at' => Carbon::now(),
            'hr_remarks' => $data['remarks'] ?? null,
            'updated_by' => $actor->id,
        ])->save();

        $this->refreshProgress($goal);
        $this->flush();

        $goal = $goal->refresh()->load('employee.user');

        app(RecognitionService::class)->autoForGoal($goal, $actor);

        $this->notifyEmployee($goal, $actor, NotificationType::OKR_FINALISED,
            'Aapka OKR final ho gaya',
            $goal->title . ' — achievement ' . $goal->achievement_percent . '%');

        return $goal;
    }

    private function achievementPercent(PerformanceGoal $goal, float $value): int
    {
        if ($goal->target_value === null || (float) $goal->target_value <= 0) {
            return max(0, min(999, (int) $goal->progress_percent));
        }

        return max(0, min(999, (int) round($value / (float) $goal->target_value * 100)));
    }

    private function assertOwner(PerformanceGoal $goal, User $actor): void
    {
        if ((int) $goal->employee->user_id === (int) $actor->id || $actor->isSuperAdmin()) {
            return;
        }

        throw new ApiException('Ye OKR aapka nahi hai.', 403, 'FORBIDDEN');
    }

    private function assertCanVerify(PerformanceGoal $goal, User $actor): void
    {
        if ((int) $goal->employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Apna OKR khud verify nahi kar sakte.', 403, 'OKR_SELF_VERIFY');
        }

        if ($actor->isSuperAdmin()
            || $actor->hasPermission(PerformanceGoal::VERIFY_PERMISSION)
            || $actor->hasPermission(AppraisalCycle::MANAGE_PERMISSION)) {
            return;
        }

        if ((int) $goal->employee->reporting_manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Aap is OKR ko verify nahi kar sakte.', 403, 'FORBIDDEN');
    }

    private function assertPermission(User $actor, string $permission, string $what): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission($permission)) {
            return;
        }

        throw new ApiException('Aapke paas ' . $what . ' ka haq nahi hai.', 403, 'FORBIDDEN');
    }

    private function notifyVerifier(PerformanceGoal $goal, User $actor): void
    {
        $managerId = (int) ($goal->employee->reporting_manager_id ?? 0);

        if ($managerId === 0 || $managerId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($managerId, [
            'type' => NotificationType::OKR_SUBMITTED,
            'title' => ($goal->employee->user?->name ?? $goal->employee->employee_code) . ' ne OKR submit kiya',
            'body' => $goal->title . ' — ' . $goal->submitted_value . ' / ' . $goal->target_value,
            'action_url' => '/goals/' . $goal->uuid,
            'entity_type' => 'performance_goal',
            'entity_id' => $goal->id,
            'payload' => ['goal_id' => $goal->id, 'submitted' => $goal->submitted_value],
            'dedupe_key' => 'okr:' . $goal->id . ':submitted',
        ]);
    }

    private function notifyHr(PerformanceGoal $goal, User $actor): void
    {
        $recipients = Recipients::except(
            Recipients::withPermission((int) $goal->company_id, PerformanceGoal::VERIFY_PERMISSION),
            [(int) $goal->employee->user_id, (int) $actor->id]
        );

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::OKR_VERIFIED,
            'title' => ($goal->employee->user?->name ?? $goal->employee->employee_code) . ' ka OKR final karna hai',
            'body' => 'Manager verify kar chuka hai — ' . $goal->manager_value . ' / ' . $goal->target_value,
            'action_url' => '/goals/' . $goal->uuid,
            'entity_type' => 'performance_goal',
            'entity_id' => $goal->id,
            'payload' => ['goal_id' => $goal->id],
            'dedupe_key' => 'okr:' . $goal->id . ':hr',
        ], $actor);
    }

    public function close(PerformanceGoal $goal, array $data, User $actor): PerformanceGoal
    {
        $this->assertCanApprove($goal, $actor);

        if ($goal->isClosed()) {
            throw new ApiException('Ye goal already band hai.', 409, 'GOAL_CLOSED');
        }

        $status = $data['status'] ?? ($goal->progress_percent >= 100
            ? PerformanceGoal::ACHIEVED
            : PerformanceGoal::MISSED);

        $goal->forceFill([
            'status' => $status,
            'closed_at' => Carbon::now(),
            'closing_remarks' => $data['remarks'] ?? null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $goal = $goal->refresh()->load('employee.user', 'keyResults');

        $this->notifyEmployee($goal, $actor, NotificationType::GOAL_CLOSED,
            'Goal band ho gaya — ' . $status,
            $goal->title . ' · ' . $goal->progress_percent . '% complete');

        return $goal;
    }

    public function delete(PerformanceGoal $goal, User $actor): void
    {
        $this->assertOwnerOrManager($goal, $actor);

        if (! $goal->isDraft()) {
            throw new ApiException('Approve hone ke baad goal hata nahi sakte, cancel karo.', 409, 'GOAL_WRONG_STAGE');
        }

        DB::transaction(function () use ($goal): void {
            $goal->keyResults()->update(['is_active' => 0]);
            $goal->deactivate();
            $this->flush();
        });
    }

    /* ------------------------------------------------------------- progress */

    /**
     * KRA / Key Result apne target ya linked tasks se, Objective apne
     * key results ke weighted average se.
     */
    public function refreshProgress(PerformanceGoal $goal): int
    {
        $percent = $goal->isObjective()
            ? $this->objectiveProgress($goal)
            : $this->leafProgress($goal);

        if ($percent !== (int) $goal->progress_percent) {
            $goal->forceFill(['progress_percent' => $percent])->save();
        }

        if ($goal->parent_id !== null) {
            $parent = PerformanceGoal::query()->whereKey($goal->parent_id)->first();

            if ($parent !== null) {
                $this->refreshProgress($parent);
            }
        }

        return $percent;
    }

    public function recalculateForTask(Task $task): void
    {
        $goalIds = DB::table('performance_goal_tasks')
            ->where('task_id', $task->id)
            ->pluck('performance_goal_id');

        foreach ($goalIds as $goalId) {
            $goal = PerformanceGoal::query()->whereKey($goalId)->first();

            if ($goal !== null) {
                $this->refreshProgress($goal);
            }
        }
    }

    /**
     * Us period ka weighted achievement — appraisal aur monthly score dono isko use karte hain.
     */
    public function achievement(Employee $employee, Carbon $start, Carbon $end): ?int
    {
        $goals = PerformanceGoal::query()
            ->where('employee_id', $employee->id)
            ->whereNull('parent_id')
            ->whereIn('status', [
                PerformanceGoal::ACTIVE,
                PerformanceGoal::ACHIEVED,
                PerformanceGoal::MISSED,
            ])
            ->whereDate('start_date', '<=', $end->toDateString())
            ->whereDate('due_date', '>=', $start->toDateString())
            ->get(['id', 'weight', 'progress_percent']);

        if ($goals->isEmpty()) {
            return null;
        }

        $totalWeight = (int) $goals->sum('weight');

        if ($totalWeight === 0) {
            return $this->clamp((int) round($goals->avg('progress_percent')));
        }

        $weighted = 0.0;

        foreach ($goals as $goal) {
            $weighted += (int) $goal->progress_percent * (int) $goal->weight;
        }

        return $this->clamp((int) round($weighted / $totalWeight));
    }

    private function objectiveProgress(PerformanceGoal $goal): int
    {
        $children = $goal->keyResults()->get(['id', 'weight', 'progress_percent']);

        if ($children->isEmpty()) {
            return (int) $goal->progress_percent;
        }

        $totalWeight = (int) $children->sum('weight');

        if ($totalWeight === 0) {
            return $this->clamp((int) round($children->avg('progress_percent')));
        }

        $weighted = 0.0;

        foreach ($children as $child) {
            $weighted += (int) $child->progress_percent * (int) $child->weight;
        }

        return $this->clamp((int) round($weighted / $totalWeight));
    }

    private function leafProgress(PerformanceGoal $goal): int
    {
        if ($goal->tracksTasks()) {
            $row = DB::table('performance_goal_tasks as gt')
                ->join('tasks as t', 't.id', '=', 'gt.task_id')
                ->where('gt.performance_goal_id', $goal->id)
                ->where('t.is_active', 1)
                ->where('t.status', '!=', Task::CANCELLED)
                ->selectRaw("COUNT(*) as total, SUM(t.status = 'done') as done")
                ->first();

            $total = (int) ($row->total ?? 0);

            return $total === 0 ? 0 : $this->clamp((int) round((int) $row->done / $total * 100));
        }

        if ($goal->target_value !== null && (float) $goal->target_value > 0 && $goal->achieved_value !== null) {
            return $this->clamp((int) round((float) $goal->achieved_value / (float) $goal->target_value * 100));
        }

        return (int) $goal->progress_percent;
    }

    /* --------------------------------------------------------------- guards */

    private function parentFor(array $data, string $type, Employee $employee): ?PerformanceGoal
    {
        if (! isset($data['parent_id'])) {
            return null;
        }

        $parent = PerformanceGoal::query()->whereKey((int) $data['parent_id'])->first();

        if ($parent === null || (int) $parent->employee_id !== (int) $employee->id) {
            throw new ApiException('Parent objective nahi mila.', 422, 'GOAL_PARENT_INVALID');
        }

        if (! $parent->isObjective()) {
            throw new ApiException('Key result sirf Objective ke andar aata hai.', 422, 'GOAL_PARENT_INVALID');
        }

        if ($type !== PerformanceGoal::TYPE_KEY_RESULT) {
            throw new ApiException('Parent sirf key result ke liye deta hai.', 422, 'GOAL_TYPE_INVALID');
        }

        return $parent;
    }

    private function assertShape(string $type, array $data, ?PerformanceGoal $parent): void
    {
        if ($type === PerformanceGoal::TYPE_KEY_RESULT && $parent === null) {
            throw new ApiException(
                'Key result ke liye parent objective dena zaroori hai.',
                422,
                'GOAL_PARENT_REQUIRED'
            );
        }

        if ($type === PerformanceGoal::TYPE_OBJECTIVE && ($data['progress_source'] ?? null) === PerformanceGoal::SOURCE_TASKS) {
            throw new ApiException(
                'Objective ka progress key results se banta hai, tasks se nahi.',
                422,
                'GOAL_PROGRESS_DERIVED'
            );
        }

        if ($type === PerformanceGoal::TYPE_KEY_RESULT
            && ($data['progress_source'] ?? PerformanceGoal::SOURCE_MANUAL) === PerformanceGoal::SOURCE_MANUAL
            && ! isset($data['target_value'])) {
            throw new ApiException(
                'Key result measurable hona chahiye — target value do ya tasks link karo.',
                422,
                'GOAL_TARGET_REQUIRED'
            );
        }
    }

    /** Ek employee ke top-level goals ka total weight 100 se zyada nahi ho sakta. */
    private function assertWeights(PerformanceGoal $goal): void
    {
        $total = (int) PerformanceGoal::query()
            ->where('employee_id', $goal->employee_id)
            ->where('parent_id', $goal->parent_id)
            ->when(
                $goal->appraisal_cycle_id === null,
                fn ($query) => $query->whereNull('appraisal_cycle_id'),
                fn ($query) => $query->where('appraisal_cycle_id', $goal->appraisal_cycle_id)
            )
            ->whereNotIn('status', [PerformanceGoal::CANCELLED])
            ->sum('weight');

        if ($total > 100) {
            throw new ApiException(
                'Weight ka total 100 se zyada ho gaya (abhi ' . $total . '%).',
                422,
                'GOAL_WEIGHT_EXCEEDED'
            );
        }
    }

    private function attachTasks(PerformanceGoal $goal, array $taskIds): void
    {
        $valid = Task::query()
            ->whereIn('id', $taskIds)
            ->where('assignee_id', $goal->employee->user_id)
            ->pluck('id')
            ->all();

        if (count($valid) !== count(array_unique($taskIds))) {
            throw new ApiException(
                'Sirf isi employee ko assign kiye hue tasks link ho sakte hain.',
                422,
                'GOAL_TASK_INVALID'
            );
        }

        $goal->tasks()->syncWithoutDetaching(
            array_fill_keys($valid, ['company_id' => $goal->company_id])
        );
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        if ($employeeId === null) {
            $employee = Employee::query()->with('user')->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Goal ke liye employee record chahiye. HR se onboarding karwao.',
                    422,
                    'EMPLOYEE_RECORD_MISSING'
                );
            }

            return $employee;
        }

        $employee = Employee::query()->with('user')->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        if ((int) $employee->user_id !== (int) $actor->id
            && ! $actor->isSuperAdmin()
            && ! $actor->hasPermission(AppraisalCycle::MANAGE_PERMISSION)
            && (int) $employee->reporting_manager_id !== (int) $actor->id) {
            throw new ApiException('Kisi aur ka goal banane ki permission nahi hai.', 403, 'FORBIDDEN');
        }

        return $employee;
    }

    private function assertOwnerOrManager(PerformanceGoal $goal, User $actor): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission(AppraisalCycle::MANAGE_PERMISSION)) {
            return;
        }

        if ((int) $goal->employee->user_id === (int) $actor->id) {
            return;
        }

        if ((int) $goal->employee->reporting_manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Ye goal aapka nahi hai.', 403, 'FORBIDDEN');
    }

    private function assertCanApprove(PerformanceGoal $goal, User $actor): void
    {
        if ((int) $goal->employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Apna goal khud approve nahi kar sakte.', 403, 'GOAL_SELF_APPROVAL');
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(AppraisalCycle::MANAGE_PERMISSION)) {
            return;
        }

        if ((int) $goal->employee->reporting_manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Aap is goal par decision nahi le sakte.', 403, 'FORBIDDEN');
    }

    private function clamp(int $value): int
    {
        return max(0, min(100, $value));
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::PERFORMANCE);
    }

    /* -------------------------------------------------------- notifications */

    private function notifyApprover(PerformanceGoal $goal, User $actor): void
    {
        $managerId = (int) ($goal->employee->reporting_manager_id ?? 0);

        if ($managerId === 0 || $managerId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($managerId, [
            'type' => NotificationType::GOAL_SUBMITTED,
            'title' => ($goal->employee->user?->name ?? $goal->employee->employee_code) . ' ne goal bheja hai',
            'body' => $goal->title . ' · due ' . $goal->due_date->format('d M Y'),
            'action_url' => '/goals/' . $goal->uuid,
            'entity_type' => 'performance_goal',
            'entity_id' => $goal->id,
            'payload' => ['goal_id' => $goal->id, 'type' => $goal->goal_type],
            'dedupe_key' => 'goal:' . $goal->id . ':submitted',
        ]);
    }

    private function notifyEmployee(PerformanceGoal $goal, User $actor, string $type, string $title, string $body): void
    {
        $userId = (int) ($goal->employee->user_id ?? 0);

        if ($userId === 0 || $userId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($userId, [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => '/goals/' . $goal->uuid,
            'entity_type' => 'performance_goal',
            'entity_id' => $goal->id,
            'payload' => ['goal_id' => $goal->id, 'progress' => $goal->progress_percent],
            'dedupe_key' => 'goal:' . $goal->id . ':' . $type,
        ]);
    }
}

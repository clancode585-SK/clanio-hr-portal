<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\PerformanceGoal;
use App\Models\Recognition;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class RecognitionService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function give(array $data, User $actor): Recognition
    {
        $this->assertPermission($actor, 'recognition dene');

        $employee = $this->employeeFor((int) $data['employee_id'], $actor);

        if ((int) $employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Khud ko recognition nahi de sakte.', 403, 'RECOGNITION_SELF');
        }

        $recognition = new Recognition([
            'type' => $data['type'] ?? Recognition::KUDOS,
            'title' => $data['title'],
            'message' => $data['message'] ?? null,
            'points' => (int) ($data['points'] ?? 0),
            'visibility' => $data['visibility'] ?? Recognition::PUBLIC,
            'awarded_on' => $data['awarded_on'] ?? Carbon::today()->toDateString(),
        ]);

        $recognition->company_id = $employee->company_id;
        $recognition->employee_id = $employee->id;
        $recognition->given_by = $actor->id;
        $recognition->performance_goal_id = $data['performance_goal_id'] ?? null;
        $recognition->created_by = $actor->id;
        $recognition->save();

        $this->flush();
        $recognition = $recognition->refresh()->load('employee.user', 'giver');

        $this->notify($recognition, $actor);

        return $recognition;
    }

    /**
     * Goal achieve hote hi apne aap ek kudos ban jata hai — ek goal par ek hi baar
     * (`recognitions.goal_key` unique isi liye hai).
     */
    public function autoForGoal(PerformanceGoal $goal, ?User $actor = null): ?Recognition
    {
        if ((int) $goal->achievement_percent < 100) {
            return null;
        }

        $exists = Recognition::query()
            ->where('performance_goal_id', $goal->id)
            ->where('is_auto', 1)
            ->exists();

        if ($exists) {
            return null;
        }

        $recognition = new Recognition([
            'type' => Recognition::BADGE,
            'title' => 'Target pura kiya',
            'message' => $goal->title . ' — ' . $goal->achievement_percent . '% achievement',
            'points' => max(10, (int) $goal->weight),
            'awarded_on' => Carbon::today()->toDateString(),
        ]);

        $recognition->company_id = $goal->company_id;
        $recognition->employee_id = $goal->employee_id;
        $recognition->performance_goal_id = $goal->id;
        $recognition->given_by = $actor?->id;
        $recognition->is_auto = true;
        $recognition->created_by = $actor?->id;
        $recognition->save();

        $this->flush();
        $recognition = $recognition->refresh()->load('employee.user');

        $this->notify($recognition, $actor);

        return $recognition;
    }

    public function delete(Recognition $recognition, User $actor): void
    {
        if (! $actor->isSuperAdmin()
            && (int) $recognition->given_by !== (int) $actor->id
            && ! $actor->hasPermission(Recognition::GIVE_PERMISSION)) {
            throw new ApiException('Ye recognition aapne nahi di thi.', 403, 'FORBIDDEN');
        }

        $recognition->deactivate();
        $this->flush();
    }

    public function summary(User $actor, ?int $employeeId): array
    {
        $employee = $employeeId === null
            ? Employee::query()->where('user_id', $actor->id)->first()
            : Employee::query()->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee record nahi mila.', 404, 'NOT_FOUND');
        }

        $row = DB::table('recognitions')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->selectRaw("
                COUNT(*) as total,
                COALESCE(SUM(points), 0) as points,
                SUM(type = 'kudos') as kudos,
                SUM(type = 'badge') as badges,
                SUM(type = 'spot_award') as awards
            ")
            ->first();

        return [
            'employee_id' => (int) $employee->id,
            'employee_name' => $employee->user?->name,
            'total' => (int) $row->total,
            'points' => (int) $row->points,
            'kudos' => (int) $row->kudos,
            'badges' => (int) $row->badges,
            'spot_awards' => (int) $row->awards,
        ];
    }

    private function employeeFor(int $employeeId, User $actor): Employee
    {
        $employee = Employee::query()->with('user')->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }

    private function assertPermission(User $actor, string $what): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission(Recognition::GIVE_PERMISSION)) {
            return;
        }

        throw new ApiException('Aapke paas ' . $what . ' ka haq nahi hai.', 403, 'FORBIDDEN');
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::PERFORMANCE);
    }

    private function notify(Recognition $recognition, ?User $actor): void
    {
        $userId = (int) ($recognition->employee->user_id ?? 0);

        if ($userId === 0 || ($actor !== null && $userId === (int) $actor->id)) {
            return;
        }

        $this->notifications->send($userId, [
            'type' => NotificationType::RECOGNITION_RECEIVED,
            'title' => $recognition->typeLabel() . ' mila — ' . $recognition->title,
            'body' => $recognition->message ?? 'Achha kaam!',
            'action_url' => '/recognitions',
            'entity_type' => 'recognition',
            'entity_id' => $recognition->id,
            'payload' => ['points' => $recognition->points, 'type' => $recognition->type],
            'dedupe_key' => 'recognition:' . $recognition->id,
        ]);
    }
}

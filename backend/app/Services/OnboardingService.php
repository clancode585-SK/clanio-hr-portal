<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\User;
use App\Support\CompanyTime;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;

final class OnboardingService
{
    public const STEP_POLICIES = 'policies';

    public const STEP_PROFILE = 'profile';

    public const STEP_TOUR = 'tour';

    public const NUDGE_AFTER_DAYS = 3;

    public function __construct(
        private readonly PolicyService $policies,
        private readonly ProfileCompletionService $completion
    ) {}

    public function state(User $actor): array
    {
        if ($actor->isSuperAdmin()) {
            return [
                'step' => null,
                'policies' => ['blocked' => false, 'pending' => 0],
                'profile' => null,
                'tour' => ['needed' => false],
            ];
        }

        $gate = $this->policies->gateStatus($actor);
        $employee = $this->employeeFor($actor);

        if ($employee === null) {
            return [
                'step' => $actor->tour_done_at === null ? self::STEP_TOUR : null,
                'policies' => ['blocked' => false, 'pending' => 0],
                'profile' => null,
                'tour' => ['needed' => $actor->tour_done_at === null],
            ];
        }

        $completion = $this->completion->forEmployee($employee);
        $seen = $employee->hasSeenProfileSetup();
        $complete = $completion['percent'] >= 100;
        $tourNeeded = $actor->tour_done_at === null;

        return [
            'step' => match (true) {
                $gate['blocked'] => self::STEP_POLICIES,
                ! $seen && ! $complete => self::STEP_PROFILE,
                $tourNeeded => self::STEP_TOUR,
                default => null,
            },
            'policies' => [
                'blocked' => $gate['blocked'],
                'pending' => $gate['pending'],
            ],
            'profile' => [
                'needed' => ! $complete,
                'seen' => $seen,
                'percent' => $completion['percent'],
                'sections' => $completion['sections'],
                'pending' => $completion['pending'],
            ],
            'tour' => ['needed' => $tourNeeded],
        ];
    }

    public function markProfileSeen(User $actor): array
    {
        $employee = $this->employeeFor($actor);

        if ($employee === null) {
            throw new ApiException(
                'This account has no employee record yet. Ask HR to onboard it first.',
                422,
                'EMPLOYEE_RECORD_MISSING'
            );
        }

        if (! $employee->hasSeenProfileSetup()) {
            $employee->forceFill([
                'profile_setup_seen_at' => CompanyTime::now($employee->company_id)->utc(),
                'profile_nudged_at' => CompanyTime::now($employee->company_id)->utc(),
            ])->saveQuietly();

            TenantCache::flush(TenantCache::EMPLOYEES);
        }

        return $this->state($actor->refresh());
    }

    public function markTourDone(User $actor): array
    {
        if ($actor->tour_done_at === null) {
            $actor->forceFill(['tour_done_at' => CompanyTime::now($actor->company_id)->utc()])->saveQuietly();

            TenantCache::flush(TenantCache::USERS);
        }

        return $this->state($actor->refresh());
    }

    public function resetTour(User $actor): array
    {
        $actor->forceFill(['tour_done_at' => null])->saveQuietly();

        TenantCache::flush(TenantCache::USERS);

        return $this->state($actor->refresh());
    }

    private function employeeFor(User $actor): ?Employee
    {
        return Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $actor->company_id)
            ->where('user_id', $actor->id)
            ->first();
    }
}

<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Employee;
use App\Services\ProfileCompletionService;
use App\Services\NotificationService;
use App\Services\OnboardingService;
use App\Support\CompanyTime;
use App\Support\NotificationType;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use Illuminate\Console\Command;

class SendProfileReminders extends Command
{
    protected $signature = 'profile:reminders';

    protected $description = 'Adhoore profile wale employees ko complete karne ka reminder bhejta hai';

    public function __construct(
        private readonly NotificationService $notifications,
        private readonly ProfileCompletionService $completion
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $sent = 0;

        foreach (Company::query()->where('status', 'active')->get(['id']) as $company) {
            app(TenantContext::class)->set($company);

            $now = CompanyTime::now($company);
            $cutoff = $now->copy()->subDays(OnboardingService::NUDGE_AFTER_DAYS);

            $employees = Employee::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->with('user')
                ->where('company_id', $company->id)
                ->where('employment_status', Employee::EMPLOYMENT_ACTIVE)
                ->whereNotNull('profile_setup_seen_at')
                ->where(fn ($query) => $query
                    ->whereNull('profile_nudged_at')
                    ->orWhere('profile_nudged_at', '<=', $cutoff->copy()->utc()))
                ->get();

            foreach ($employees as $employee) {
                if ($employee->user === null) {
                    continue;
                }

                $state = $this->completion->forUser($employee->user);

                if ($state['percent'] >= 100) {
                    continue;
                }

                $this->notifications->send((int) $employee->user_id, [
                    'type' => NotificationType::PROFILE_INCOMPLETE,
                    'title' => 'Please complete your profile',
                    'body' => $state['percent'] . '% done. Still needed: '
                        . implode(', ', $state['pending']),
                    'action_url' => '/profile',
                    'entity_type' => 'employee',
                    'entity_id' => $employee->id,
                    'payload' => [
                        'percent' => $state['percent'],
                        'pending' => $state['pending'],
                    ],
                    'dedupe_key' => 'profile-nudge:' . $employee->id . ':' . $now->toDateString(),
                ]);

                $employee->forceFill(['profile_nudged_at' => $now->copy()->utc()])->saveQuietly();

                $sent++;
            }
        }

        app(TenantContext::class)->forget();

        $this->info($sent . ' profile reminder bheje gaye.');

        return self::SUCCESS;
    }
}

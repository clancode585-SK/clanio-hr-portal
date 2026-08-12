<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\PolicyAcknowledgement;
use App\Services\NotificationService;
use App\Support\NotificationType;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendPolicyReminders extends Command
{
    protected $signature = 'policy:reminders';

    protected $description = 'Pending policy acceptance ka reminder bhejta hai';

    public function __construct(private readonly NotificationService $notifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $today = Carbon::today();
        $sent = 0;

        foreach (Company::query()->where('status', 'active')->get(['id']) as $company) {
            app(TenantContext::class)->set($company);

            $pending = PolicyAcknowledgement::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->with('policy', 'employee')
                ->where('company_id', $company->id)
                ->where('status', PolicyAcknowledgement::PENDING)
                ->get();

            foreach ($pending as $ack) {
                if ($ack->policy === null || $ack->employee?->user_id === null) {
                    continue;
                }

                $overdue = $ack->due_on !== null && $ack->due_on->lessThan($today);

                $this->notifications->send((int) $ack->employee->user_id, [
                    'type' => NotificationType::POLICY_REMINDER,
                    'title' => $overdue
                        ? 'Policy accept karna baaki hai — date nikal chuki'
                        : 'Policy accept karna baaki hai',
                    'body' => $ack->policy->title . ' (v' . $ack->policy->version . ')'
                        . ($ack->due_on === null ? '' : ' · due ' . $ack->due_on->format('d M Y')),
                    'action_url' => '/my-policies',
                    'entity_type' => 'policy',
                    'entity_id' => $ack->policy_id,
                    'payload' => [
                        'policy_id' => $ack->policy_id,
                        'overdue' => $overdue,
                    ],
                    'dedupe_key' => 'policy-reminder:' . $ack->id . ':' . $today->toDateString(),
                ]);

                $sent++;
            }
        }

        app(TenantContext::class)->forget();

        $this->info($sent . ' policy reminder bheje gaye.');

        return self::SUCCESS;
    }
}

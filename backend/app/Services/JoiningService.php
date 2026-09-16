<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Application;
use App\Models\Employee;
use App\Models\OfferLetter;
use App\Models\User;
use App\Support\CompanyTime;
use App\Support\NotificationType;
use App\Support\TenantCache;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class JoiningService
{
    public function __construct(
        private readonly UserService $users,
        private readonly NotificationService $notifications
    ) {}

    public function pipeline(int $companyId): array
    {
        $today = CompanyTime::day($companyId);

        $rows = Application::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->whereNull('employee_id')
            ->whereIn('stage', [Application::STAGE_OFFER, Application::STAGE_JOINED])
            ->whereHas('offerLetter', fn ($query) => $query->where('status', OfferLetter::STATUS_ACCEPTED))
            ->with(['candidate', 'opening', 'offerLetter'])
            ->get();

        $buckets = ['overdue' => [], 'this_week' => [], 'later' => []];

        foreach ($rows as $application) {
            $date = $application->offerLetter?->joining_date ?? $application->joining_date;

            if ($date === null) {
                continue;
            }

            $days = $today->diffInDays($date, false);
            $entry = [
                'application_uuid' => $application->uuid,
                'candidate' => $application->candidate?->name,
                'email' => $application->candidate?->email,
                'phone' => $application->candidate?->phone,
                'role' => $application->opening?->title,
                'designation' => $application->offerLetter?->designation,
                'joining_date' => $date->toDateString(),
                'days_away' => $days,
                'annual_ctc' => $application->offerLetter?->annual_ctc,
                'letter_number' => $application->offerLetter?->letter_number,
            ];

            if ($days < 0) {
                $buckets['overdue'][] = $entry;
            } elseif ($days <= 7) {
                $buckets['this_week'][] = $entry;
            } else {
                $buckets['later'][] = $entry;
            }
        }

        foreach ($buckets as $key => $list) {
            usort($list, static fn (array $a, array $b): int => strcmp($a['joining_date'], $b['joining_date']));
            $buckets[$key] = $list;
        }

        return $buckets + [
            'total' => $rows->count(),
            'joined_this_month' => Application::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereNotNull('employee_id')
                ->whereDate('converted_at', '>=', $today->copy()->startOfMonth())
                ->count(),
        ];
    }

    public function convert(Application $application, array $data, User $actor): Employee
    {
        if ($application->employee_id !== null) {
            throw new ApiException('This candidate is already on the roll.', 409, 'ALREADY_CONVERTED');
        }

        $letter = $application->offerLetter;

        if ($letter === null || $letter->status !== OfferLetter::STATUS_ACCEPTED) {
            throw new ApiException(
                'Only a candidate who accepted their offer letter can be put on the roll.',
                409,
                'OFFER_NOT_ACCEPTED'
            );
        }

        $application->loadMissing(['candidate', 'opening']);
        $candidate = $application->candidate;

        if ($candidate === null) {
            throw new ApiException('This application has no candidate on it.', 409, 'CANDIDATE_MISSING');
        }

        $clash = User::query()
            ->withoutGlobalScopes()
            ->where('company_id', $application->company_id)
            ->where('email', $candidate->email)
            ->where('is_active', 1)
            ->exists();

        if ($clash) {
            throw new ApiException(
                $candidate->email . ' already has a login in this company. Use a different work email.',
                409,
                'EMAIL_IN_USE'
            );
        }

        return DB::transaction(function () use ($application, $candidate, $letter, $data, $actor): Employee {
            $password = $data['password'] ?? Str::random(12);

            $user = $this->users->create([
                'name' => $candidate->name,
                'email' => $data['work_email'] ?? $candidate->email,
                'phone' => $candidate->phone,
                'password' => $password,
                'role_ids' => [(int) $data['role_id']],
                'branch_id' => $data['branch_id'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'team_id' => $data['team_id'] ?? null,
            ], $actor, (int) $application->company_id);

            $employee = new Employee([
                'date_of_joining' => $letter->joining_date?->toDateString(),
                'employment_type' => $letter->employment_type,
                'designation_id' => $data['designation_id'] ?? $application->opening?->designation_id,
                'work_shift_id' => $data['work_shift_id'] ?? null,
                'reporting_manager_id' => $data['reporting_manager_id'] ?? null,
                'personal_email' => $candidate->email,
                'personal_phone' => $candidate->phone,
                'current_address' => $candidate->current_location,
            ]);

            $employee->company_id = $application->company_id;
            $employee->user_id = $user->id;
            $employee->employee_code = $this->nextCode((int) $application->company_id);
            $employee->onboarding_status = Employee::ONBOARDING_IN_PROGRESS;
            $employee->created_by = $actor->id;
            $employee->save();

            $application->forceFill([
                'stage' => Application::STAGE_JOINED,
                'employee_id' => $employee->id,
                'joining_date' => $letter->joining_date?->toDateString(),
                'converted_at' => Carbon::now(),
                'converted_by' => $actor->id,
                'stage_changed_at' => Carbon::now(),
                'stage_changed_by' => $actor->id,
            ])->save();

            TenantCache::flush(TenantCache::EMPLOYEES, TenantCache::USERS, TenantCache::COMPANIES);

            $this->announce($employee, $user, $application, $actor);

            return $employee->refresh();
        });
    }

    private function nextCode(int $companyId): string
    {
        $last = Employee::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('employee_code', 'like', 'EMP%')
            ->orderByDesc('employee_code')
            ->value('employee_code');

        $next = $last === null ? 1 : ((int) substr((string) $last, 3)) + 1;

        return 'EMP' . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function announce(Employee $employee, User $user, Application $application, User $actor): void
    {
        $watchers = User::query()
            ->withoutGlobalScopes()
            ->where('company_id', $employee->company_id)
            ->where('status', 'active')
            ->whereKeyNot($user->id)
            ->whereHas('roles.permissions', fn ($query) => $query->whereIn('slug', ['employee.view', 'recruitment.manage']))
            ->pluck('id')
            ->unique()
            ->all();

        if ($watchers !== []) {
            $this->notifications->sendMany($watchers, [
                'type' => NotificationType::JOINING_DONE,
                'title' => 'New joining: ' . $user->name,
                'body' => $user->name . ' is on the roll as ' . $employee->employee_code
                    . ' from ' . $employee->date_of_joining . '. Onboarding has started.',
                'action_url' => '/employees/' . $employee->uuid,
                'entity_type' => 'employee',
                'entity_id' => $employee->id,
            ], $actor);
        }

        $this->notifications->send((int) $user->id, [
            'type' => NotificationType::JOINING_WELCOME,
            'title' => 'Welcome aboard',
            'body' => 'Your employee code is ' . $employee->employee_code
                . '. Finish your profile, documents and bank details to wrap up onboarding.',
            'action_url' => '/profile',
            'entity_type' => 'employee',
            'entity_id' => $employee->id,
        ], $actor);
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Mail\InterviewScheduledMail;
use App\Models\Application;
use App\Models\Company;
use App\Models\Interview;
use App\Models\User;
use App\Support\CompanyTime;
use App\Support\Meeting;
use App\Support\NotificationType;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

final class InterviewService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function schedule(Application $application, array $data, User $actor): Interview
    {
        if (in_array($application->stage, [Application::STAGE_JOINED, Application::STAGE_REJECTED, Application::STAGE_DROPPED], true)) {
            throw new ApiException(
                'This application is closed. Reopen it before scheduling an interview.',
                409,
                'APPLICATION_CLOSED'
            );
        }

        $data = $this->normalise($data, (int) $application->company_id);

        $this->assertFree($data, $application->company_id, null);

        return DB::transaction(function () use ($application, $data, $actor): Interview {
            $round = (int) ($data['round_no'] ?? $this->nextRound($application));

            $interview = new Interview(Arr::only($data, [
                'title',
                'kind',
                'mode',
                'interviewer_id',
                'scheduled_at',
                'duration_minutes',
                'location',
            ]));

            $interview->company_id = $application->company_id;
            $interview->application_id = $application->id;
            $interview->round_no = $round;
            $interview->created_by = $actor->id;

            if (($data['mode'] ?? Interview::MODE_VIDEO) === Interview::MODE_VIDEO) {
                $company = Company::query()->withoutGlobalScopes()->find($application->company_id);
                $interview->meeting_room = Meeting::room((string) ($company->slug ?? 'clanio'), (string) $application->uuid, $round);
                $interview->meeting_url = Meeting::url($interview->meeting_room);
            }

            $interview->save();

            if (in_array($application->stage, [Application::STAGE_APPLIED, Application::STAGE_SCREENING], true)) {
                $application->forceFill([
                    'stage' => Application::STAGE_INTERVIEW,
                    'stage_changed_at' => Carbon::now(),
                    'stage_changed_by' => $actor->id,
                ])->save();
            }

            $this->announce($interview->fresh(['application.candidate', 'application.opening', 'interviewer']), $actor, false);

            return $interview;
        });
    }

    public function reschedule(Interview $interview, array $data, User $actor): Interview
    {
        if (! $interview->isOpen()) {
            throw new ApiException('Only a scheduled interview can be moved.', 409, 'INTERVIEW_CLOSED');
        }

        $data = $this->normalise($data, (int) $interview->company_id);

        $this->assertFree($data + ['interviewer_id' => $data['interviewer_id'] ?? $interview->interviewer_id], (int) $interview->company_id, (int) $interview->id);

        $wasVideo = $interview->mode === Interview::MODE_VIDEO;
        $interview->fill(Arr::only($data, [
            'title',
            'kind',
            'mode',
            'interviewer_id',
            'scheduled_at',
            'duration_minutes',
            'location',
        ]));

        if ($interview->mode === Interview::MODE_VIDEO && ! $wasVideo) {
            $company = Company::query()->withoutGlobalScopes()->find($interview->company_id);
            $interview->meeting_room = Meeting::room(
                (string) ($company->slug ?? 'clanio'),
                (string) $interview->application?->uuid,
                (int) $interview->round_no
            );
            $interview->meeting_url = Meeting::url((string) $interview->meeting_room);
        }

        if ($interview->mode !== Interview::MODE_VIDEO) {
            $interview->meeting_room = null;
            $interview->meeting_url = null;
        }

        $interview->updated_by = $actor->id;
        $interview->save();

        $this->announce($interview->fresh(['application.candidate', 'application.opening', 'interviewer']), $actor, true);

        return $interview->refresh();
    }

    public function submit(Interview $interview, array $data, User $actor): Interview
    {
        if ($interview->status === Interview::STATUS_CANCELLED) {
            throw new ApiException('This interview was cancelled.', 409, 'INTERVIEW_CANCELLED');
        }

        if ($interview->submitted_at !== null) {
            throw new ApiException('Feedback for this round is already in.', 409, 'FEEDBACK_SUBMITTED');
        }

        $interview->forceFill([
            'status' => $data['status'] ?? Interview::STATUS_DONE,
            'verdict' => $data['verdict'] ?? null,
            'rating' => $data['rating'] ?? null,
            'feedback' => $data['feedback'] ?? null,
            'submitted_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->reportBack($interview->fresh(['application.candidate', 'application.opening']), $actor);

        return $interview->refresh();
    }

    public function cancel(Interview $interview, ?string $reason, User $actor): Interview
    {
        if ($interview->submitted_at !== null) {
            throw new ApiException('Feedback is already in, so this round cannot be cancelled.', 409, 'FEEDBACK_SUBMITTED');
        }

        if ($interview->status === Interview::STATUS_CANCELLED) {
            throw new ApiException('This interview is already cancelled.', 409, 'INTERVIEW_CANCELLED');
        }

        $interview->forceFill([
            'status' => Interview::STATUS_CANCELLED,
            'cancel_reason' => $reason,
            'updated_by' => $actor->id,
        ])->save();

        if ($interview->interviewer_id !== null) {
            $this->notifications->send((int) $interview->interviewer_id, [
                'type' => NotificationType::INTERVIEW_CANCELLED,
                'title' => 'Interview cancelled',
                'body' => $interview->label() . ' with '
                    . ($interview->application?->candidate?->name ?? 'the candidate') . ' is off.'
                    . ($reason === null ? '' : ' Reason: ' . $reason),
                'action_url' => '/interviews',
                'entity_type' => 'interview',
                'entity_id' => $interview->id,
            ], $actor);
        }

        return $interview->refresh();
    }

    private function nextRound(Application $application): int
    {
        $last = Interview::query()
            ->withoutGlobalScopes()
            ->where('application_id', $application->id)
            ->where('is_active', 1)
            ->max('round_no');

        return (int) $last + 1;
    }

    private function normalise(array $data, int $companyId): array
    {
        if (! isset($data['scheduled_at']) || $data['scheduled_at'] === null) {
            return $data;
        }

        $data['scheduled_at'] = CompanyTime::parse((string) $data['scheduled_at'], $companyId)
            ->utc()
            ->toDateTimeString();

        return $data;
    }

    private function assertFree(array $data, int $companyId, ?int $ignoreId): void
    {
        $interviewer = $data['interviewer_id'] ?? null;
        $start = $data['scheduled_at'] ?? null;

        if ($interviewer === null || $start === null) {
            return;
        }

        $from = Carbon::parse((string) $start);
        $to = $from->copy()->addMinutes((int) ($data['duration_minutes'] ?? 45));

        $clash = Interview::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->where('interviewer_id', $interviewer)
            ->where('status', Interview::STATUS_SCHEDULED)
            ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
            ->get()
            ->first(function (Interview $other) use ($from, $to): bool {
                $otherEnd = $other->endsAt();

                return $other->scheduled_at !== null
                    && $otherEnd !== null
                    && $from->lt($otherEnd)
                    && $to->gt($other->scheduled_at);
            });

        if ($clash !== null) {
            throw new ApiException(
                'That interviewer already has ' . $clash->label() . ' at '
                . CompanyTime::toZone($clash->scheduled_at, $companyId)?->format('j M, g:i A') . '. Pick another slot.',
                409,
                'INTERVIEWER_BUSY'
            );
        }
    }

    private function announce(?Interview $interview, User $actor, bool $rescheduled): void
    {
        if ($interview === null) {
            return;
        }

        $candidate = $interview->application?->candidate;
        $role = $interview->application?->opening?->title ?? 'the role';

        if ($interview->interviewer_id !== null) {
            $this->notifications->send((int) $interview->interviewer_id, [
                'type' => $rescheduled ? NotificationType::INTERVIEW_RESCHEDULED : NotificationType::INTERVIEW_SCHEDULED,
                'title' => ($rescheduled ? 'Interview moved: ' : 'Interview to take: ') . ($candidate->name ?? 'Candidate'),
                'body' => $interview->label() . ' for ' . $role . ' on '
                    . CompanyTime::toZone($interview->scheduled_at, (int) $interview->company_id)?->format('j M, g:i A') . '.',
                'action_url' => '/interviews',
                'entity_type' => 'interview',
                'entity_id' => $interview->id,
            ], $actor);
        }

        if ($candidate === null || $candidate->email === null) {
            return;
        }

        $company = Company::query()->withoutGlobalScopes()->find($interview->company_id);

        if ($company === null) {
            return;
        }

        try {
            Mail::to($candidate->email)->send(new InterviewScheduledMail($company, $interview, $rescheduled));
        } catch (\Throwable $caught) {
            Log::warning('Interview email failed: ' . $caught->getMessage());
        }
    }

    private function reportBack(?Interview $interview, User $actor): void
    {
        if ($interview === null) {
            return;
        }

        $watchers = User::query()
            ->withoutGlobalScopes()
            ->where('company_id', $interview->company_id)
            ->where('status', 'active')
            ->whereHas('roles.permissions', fn ($query) => $query->where('slug', 'recruitment.manage'))
            ->pluck('id')
            ->all();

        if ($watchers === []) {
            return;
        }

        $this->notifications->sendMany($watchers, [
            'type' => NotificationType::INTERVIEW_FEEDBACK,
            'title' => 'Interview feedback in: ' . ($interview->application?->candidate?->name ?? 'Candidate'),
            'body' => $interview->label() . ' — ' . ucfirst((string) ($interview->verdict ?? 'no verdict'))
                . ($interview->rating === null ? '' : ' (' . $interview->rating . '/5)'),
            'action_url' => '/openings/' . ($interview->application?->opening?->uuid ?? ''),
            'entity_type' => 'interview',
            'entity_id' => $interview->id,
        ], $actor);
    }
}

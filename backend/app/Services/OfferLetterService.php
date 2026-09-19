<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Mail\OfferLetterMail;
use App\Models\Application;
use App\Models\Company;
use App\Models\OfferLetter;
use App\Models\User;
use App\Support\CompanyTime;
use App\Support\NotificationType;
use App\Support\Pdf;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

final class OfferLetterService
{
    private const PREFIX = 'OL';

    public function __construct(private readonly NotificationService $notifications) {}

    public function issue(Application $application, array $data, User $actor): OfferLetter
    {
        if ($application->stage !== Application::STAGE_OFFER) {
            throw new ApiException(
                'Move the candidate to the offer stage first, then raise the letter.',
                409,
                'NOT_AT_OFFER'
            );
        }

        $existing = OfferLetter::query()
            ->withoutGlobalScopes()
            ->where('application_id', $application->id)
            ->where('is_active', 1)
            ->first();

        if ($existing !== null) {
            throw new ApiException(
                'An offer letter ' . $existing->letter_number . ' is already out for this candidate.',
                409,
                'OFFER_EXISTS'
            );
        }

        $application->loadMissing(['candidate', 'opening.designation', 'opening.department']);

        return DB::transaction(function () use ($application, $data, $actor): OfferLetter {
            $letter = new OfferLetter(Arr::only($data, [
                'designation',
                'department',
                'location',
                'employment_type',
                'annual_ctc',
                'joining_date',
                'reporting_to',
                'probation_months',
                'notice_days',
                'valid_till',
                'extra_terms',
            ]));

            $letter->company_id = $application->company_id;
            $letter->application_id = $application->id;
            $letter->letter_number = $this->nextNumber();
            $letter->candidate_name = (string) $application->candidate?->name;
            $letter->role_title = (string) $application->opening?->title;
            $letter->designation = $data['designation'] ?? $application->opening?->designation?->name;
            $letter->department = $data['department'] ?? $application->opening?->department?->name;
            $letter->location = $data['location'] ?? (string) $application->opening?->location;
            $letter->employment_type = $data['employment_type'] ?? (string) $application->opening?->employment_type;
            $letter->issued_at = Carbon::now();
            $letter->signed_by = $actor->id;
            $letter->created_by = $actor->id;
            $letter->save();

            $application->forceFill([
                'offered_ctc' => $letter->annual_ctc,
                'offer_date' => $letter->issued_at->toDateString(),
                'joining_date' => $letter->joining_date?->toDateString(),
                'updated_by' => $actor->id,
            ])->save();

            $this->post($letter->fresh(['application.candidate', 'application.opening']), $actor);

            return $letter;
        });
    }

    public function answer(OfferLetter $letter, string $status, ?string $reason, User $actor): OfferLetter
    {
        if (! $letter->isOpen()) {
            throw new ApiException('This letter is already ' . $letter->status . '.', 409, 'OFFER_CLOSED');
        }

        if ($status === OfferLetter::STATUS_DECLINED && ($reason === null || trim($reason) === '')) {
            throw new ApiException('Say why the candidate turned it down.', 422, 'REASON_REQUIRED');
        }

        $letter->forceFill([
            'status' => $status,
            'responded_at' => Carbon::now(),
            'decline_reason' => $status === OfferLetter::STATUS_DECLINED ? $reason : null,
            'updated_by' => $actor->id,
        ])->save();

        $application = $letter->relationLoaded('application')
            ? $letter->getRelation('application')
            : Application::query()->withoutGlobalScopes()->find($letter->application_id);

        if ($application !== null && $status === OfferLetter::STATUS_DECLINED) {
            $application->forceFill([
                'stage' => Application::STAGE_DROPPED,
                'rejection_reason' => $reason,
                'stage_changed_at' => Carbon::now(),
                'stage_changed_by' => $actor->id,
            ])->save();
        }

        $this->report($letter->fresh(['application.candidate']), $status, $actor);

        return $letter->refresh();
    }

    public function withdraw(OfferLetter $letter, ?string $reason, User $actor): OfferLetter
    {
        if (! $letter->isOpen()) {
            throw new ApiException('Only an open letter can be pulled back.', 409, 'OFFER_CLOSED');
        }

        $letter->forceFill([
            'status' => OfferLetter::STATUS_WITHDRAWN,
            'responded_at' => Carbon::now(),
            'decline_reason' => $reason,
            'updated_by' => $actor->id,
        ])->save();

        return $letter->refresh();
    }

    public function pdf(OfferLetter $letter): string
    {
        return Pdf::fromHtml($this->html($letter));
    }

    public function html(OfferLetter $letter): string
    {
        $company = Company::query()->withoutGlobalScopes()->find($letter->company_id);

        return view('mail.offer-letter-page', [
            'letter' => $letter,
            'company' => $company,
        ])->render();
    }

    private function nextNumber(): string
    {
        $year = CompanyTime::now()->year;
        $prefix = self::PREFIX . '-' . $year . '-';

        $last = OfferLetter::query()
            ->withoutGlobalScopes()
            ->where('letter_number', 'like', $prefix . '%')
            ->lockForUpdate()
            ->orderByDesc('letter_number')
            ->value('letter_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, strlen($prefix))) + 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function post(?OfferLetter $letter, User $actor): void
    {
        if ($letter === null) {
            return;
        }

        $candidate = $letter->application?->candidate;

        if ($candidate === null || $candidate->email === null) {
            return;
        }

        $company = Company::query()->withoutGlobalScopes()->find($letter->company_id);

        if ($company === null) {
            return;
        }

        try {
            Mail::to($candidate->email)->send(new OfferLetterMail($company, $letter));
        } catch (\Throwable $caught) {
            Log::warning('Offer letter email failed: ' . $caught->getMessage());
        }
    }

    private function report(?OfferLetter $letter, string $status, User $actor): void
    {
        if ($letter === null) {
            return;
        }

        $watchers = User::query()
            ->withoutGlobalScopes()
            ->where('company_id', $letter->company_id)
            ->where('status', 'active')
            ->whereHas('roles.permissions', fn ($query) => $query->where('slug', 'recruitment.manage'))
            ->pluck('id')
            ->all();

        if ($watchers === []) {
            return;
        }

        $this->notifications->sendMany($watchers, [
            'type' => NotificationType::OFFER_ANSWERED,
            'title' => $letter->candidate_name . ' ' . ($status === OfferLetter::STATUS_ACCEPTED ? 'accepted' : 'turned down')
                . ' the offer',
            'body' => $letter->letter_number . ' for ' . $letter->role_title
                . ($letter->decline_reason === null ? '' : '. ' . $letter->decline_reason),
            'action_url' => '/openings/' . ($letter->application?->opening?->uuid ?? ''),
            'entity_type' => 'offer_letter',
            'entity_id' => $letter->id,
        ], $actor);
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Mail\ApplicationReceivedMail;
use App\Models\Application;
use App\Models\Candidate;
use App\Models\CareerPage;
use App\Models\Company;
use App\Models\JobOpening;
use App\Models\User;
use App\Support\NotificationType;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class RecruitmentService
{
    private const DISK = 'local';

    public function __construct(private readonly NotificationService $notifications) {}

    public function createOpening(array $data, User $actor, ?int $companyId): JobOpening
    {
        if ($companyId === null) {
            throw new ApiException(
                'An opening belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        $opening = new JobOpening(Arr::except($data, ['slug']));
        $opening->company_id = $companyId;
        $opening->slug = $this->uniqueSlug($data['slug'] ?? $data['title'], $companyId, null);
        $opening->created_by = $actor->id;

        if ($opening->status === JobOpening::STATUS_OPEN) {
            $opening->published_at = Carbon::now();
        }

        $opening->save();

        return $opening;
    }

    public function requestOpening(array $data, User $actor, ?int $companyId): JobOpening
    {
        if ($companyId === null) {
            throw new ApiException(
                'A vacancy request belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        $opening = new JobOpening(Arr::except($data, ['slug', 'status']));
        $opening->company_id = $companyId;
        $opening->slug = $this->uniqueSlug($data['slug'] ?? $data['title'], $companyId, null);
        $opening->status = JobOpening::STATUS_REQUESTED;
        $opening->requested_by = $actor->id;
        $opening->requested_at = Carbon::now();
        $opening->created_by = $actor->id;
        $opening->save();

        $this->tellHr($opening, $actor);

        return $opening;
    }

    public function decideRequest(JobOpening $opening, bool $approve, ?string $reason, User $actor): JobOpening
    {
        if (! $opening->needsApproval()) {
            throw new ApiException('This one is not waiting on a decision.', 409, 'NOT_PENDING');
        }

        if (! $approve && ($reason === null || trim($reason) === '')) {
            throw new ApiException('Say why the vacancy is being turned down.', 422, 'REASON_REQUIRED');
        }

        $opening->forceFill([
            'status' => $approve ? JobOpening::STATUS_DRAFT : JobOpening::STATUS_DECLINED,
            'approved_by' => $actor->id,
            'approved_at' => Carbon::now(),
            'decline_reason' => $approve ? null : $reason,
            'updated_by' => $actor->id,
        ])->save();

        if ($opening->requested_by !== null) {
            $this->notifications->send((int) $opening->requested_by, [
                'type' => $approve ? NotificationType::VACANCY_APPROVED : NotificationType::VACANCY_DECLINED,
                'title' => $approve
                    ? 'Vacancy approved: ' . $opening->title
                    : 'Vacancy turned down: ' . $opening->title,
                'body' => $approve
                    ? 'HR will write the description and put it on the career page.'
                    : (string) $reason,
                'action_url' => '/openings',
                'entity_type' => 'job_opening',
                'entity_id' => $opening->id,
            ], $actor);
        }

        return $opening->refresh();
    }

    public function updateOpening(JobOpening $opening, array $data, User $actor): JobOpening
    {
        $wasOpen = $opening->status === JobOpening::STATUS_OPEN;

        if (array_key_exists('slug', $data) || array_key_exists('title', $data)) {
            $opening->slug = $this->uniqueSlug(
                $data['slug'] ?? $opening->slug,
                (int) $opening->company_id,
                (int) $opening->id
            );
        }

        $opening->fill(Arr::except($data, ['slug']));
        $opening->updated_by = $actor->id;

        if (! $wasOpen && $opening->status === JobOpening::STATUS_OPEN && $opening->published_at === null) {
            $opening->published_at = Carbon::now();
        }

        if ($opening->status === JobOpening::STATUS_CLOSED && $opening->closed_at === null) {
            $opening->closed_at = Carbon::now();
        }

        if ($opening->status !== JobOpening::STATUS_CLOSED) {
            $opening->closed_at = null;
        }

        $opening->save();

        return $opening->refresh();
    }

    public function deleteOpening(JobOpening $opening): void
    {
        if ($opening->applications()->whereIn('stage', Application::OPEN_STAGES)->exists()) {
            throw new ApiException(
                'Candidates are still in the running for this opening. Close it instead of removing it.',
                409,
                'OPENING_IN_USE'
            );
        }

        $opening->deactivate();
    }

    public function apply(
        Company $company,
        JobOpening $opening,
        array $data,
        ?UploadedFile $resume,
        ?User $actor,
        ?string $ip
    ): Application {
        if (! $opening->isLive()) {
            throw new ApiException('This opening is no longer accepting applications.', 409, 'OPENING_CLOSED');
        }

        return DB::transaction(function () use ($company, $opening, $data, $resume, $actor, $ip): Application {
            $candidate = Candidate::query()
                ->withoutGlobalScopes()
                ->where('company_id', $company->id)
                ->where('is_active', 1)
                ->where('email', strtolower((string) $data['email']))
                ->first();

            $fields = Arr::only($data, [
                'name',
                'phone',
                'total_experience',
                'current_company',
                'current_location',
                'current_ctc',
                'expected_ctc',
                'notice_period_days',
                'linkedin_url',
                'source',
                'source_detail',
                'referred_by',
            ]);

            if ($candidate !== null) {
                $already = Application::query()
                    ->withoutGlobalScopes()
                    ->where('job_opening_id', $opening->id)
                    ->where('candidate_id', $candidate->id)
                    ->where('is_active', 1)
                    ->exists();

                if ($already) {
                    throw new ApiException(
                        'You have already applied for this opening. The team will reach out to you.',
                        409,
                        'ALREADY_APPLIED'
                    );
                }

                $candidate->fill(array_filter($fields, static fn ($value): bool => $value !== null && $value !== ''));
                $candidate->updated_by = $actor?->id;
            } else {
                $candidate = new Candidate($fields);
                $candidate->company_id = $company->id;
                $candidate->email = strtolower((string) $data['email']);
                $candidate->portal_token = Str::lower(Str::random(48));
                $candidate->created_by = $actor?->id;
            }

            if ($resume !== null) {
                $this->attachResume($candidate, $company, $resume);
            }

            $candidate->save();

            $application = new Application([
                'job_opening_id' => $opening->id,
                'candidate_id' => $candidate->id,
                'stage' => Application::STAGE_APPLIED,
                'cover_note' => $data['cover_note'] ?? null,
                'source' => $data['source'] ?? 'website',
                'source_detail' => $data['source_detail'] ?? null,
            ]);

            $application->company_id = $company->id;
            $application->stage_changed_at = Carbon::now();
            $application->stage_changed_by = $actor?->id;
            $application->applied_ip = $ip;
            $application->created_by = $actor?->id;
            $application->save();

            $this->announce($company, $opening, $candidate);
            $this->thankThem($company, $opening, $candidate, $application);

            return $application;
        });
    }

    public function moveStage(Application $application, array $data, User $actor): Application
    {
        $stage = (string) $data['stage'];

        if ($application->stage === $stage) {
            return $application;
        }

        if ($application->stage === Application::STAGE_JOINED) {
            throw new ApiException('This candidate has already joined.', 409, 'ALREADY_JOINED');
        }

        if ($stage === Application::STAGE_REJECTED && ($data['rejection_reason'] ?? null) === null) {
            throw new ApiException('Say why the candidate is being rejected.', 422, 'REASON_REQUIRED');
        }

        if ($stage === Application::STAGE_OFFER && ($data['offered_ctc'] ?? null) === null) {
            throw new ApiException('An offer needs the offered CTC.', 422, 'CTC_REQUIRED');
        }

        if ($stage === Application::STAGE_JOINED && ($data['joining_date'] ?? null) === null) {
            throw new ApiException('A joining date is needed before marking the candidate joined.', 422, 'DATE_REQUIRED');
        }

        $application->fill(Arr::only($data, [
            'stage',
            'rating',
            'rejection_reason',
            'offered_ctc',
            'offer_date',
            'joining_date',
        ]));

        $application->stage_changed_at = Carbon::now();
        $application->stage_changed_by = $actor->id;
        $application->updated_by = $actor->id;
        $application->save();

        return $application->refresh();
    }

    public function resume(Candidate $candidate)
    {
        if ($candidate->resume_path === null || ! Storage::disk(self::DISK)->exists($candidate->resume_path)) {
            throw new ApiException('No resume is on file for this candidate.', 404, 'RESUME_MISSING');
        }

        return Storage::disk(self::DISK)->download(
            $candidate->resume_path,
            $candidate->resume_name ?? 'resume.pdf'
        );
    }

    public function touchPage(CareerPage $page, ?string $domain): CareerPage
    {
        $page->forceFill([
            'connected_at' => $page->connected_at ?? Carbon::now(),
            'last_seen_at' => Carbon::now(),
            'last_seen_domain' => $domain ?? $page->last_seen_domain,
        ])->saveQuietly();

        $page->newQuery()->withoutGlobalScopes()->whereKey($page->id)->increment('view_count');

        return $page;
    }

    public function pageFor(Company $company, User $actor): CareerPage
    {
        $page = CareerPage::query()->where('company_id', $company->id)->first();

        if ($page !== null) {
            return $page;
        }

        $page = new CareerPage();
        $page->company_id = $company->id;
        $page->embed_key = $this->uniqueKey($company);
        $page->created_by = $actor->id;
        $page->save();

        return $page;
    }

    private function attachResume(Candidate $candidate, Company $company, UploadedFile $resume): void
    {
        if ($candidate->resume_path !== null && Storage::disk(self::DISK)->exists($candidate->resume_path)) {
            Storage::disk(self::DISK)->delete($candidate->resume_path);
        }

        $candidate->resume_path = $resume->storeAs(
            'companies/' . $company->id . '/resumes',
            Str::uuid()->toString() . '.' . strtolower($resume->getClientOriginalExtension() ?: 'bin'),
            self::DISK
        );

        $candidate->resume_name = $resume->getClientOriginalName();
        $candidate->resume_size = $resume->getSize() ?: 0;
    }

    private function announce(Company $company, JobOpening $opening, Candidate $candidate): void
    {
        $watchers = User::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('status', 'active')
            ->whereHas('roles.permissions', fn ($query) => $query->where('slug', 'recruitment.manage'))
            ->pluck('id')
            ->all();

        if ($watchers === []) {
            return;
        }

        $this->notifications->sendMany($watchers, [
            'type' => NotificationType::RECRUITMENT_APPLIED,
            'title' => 'New application for ' . $opening->title,
            'body' => $candidate->name . ' applied from ' . $candidate->source . '.',
            'action_url' => '/openings/' . $opening->uuid,
            'entity_type' => 'job_opening',
            'entity_id' => $opening->id,
        ]);
    }

    private function tellHr(JobOpening $opening, User $actor): void
    {
        $watchers = User::query()
            ->withoutGlobalScopes()
            ->where('company_id', $opening->company_id)
            ->where('status', 'active')
            ->whereKeyNot($actor->id)
            ->whereHas('roles.permissions', fn ($query) => $query->where('slug', 'recruitment.manage'))
            ->pluck('id')
            ->all();

        if ($watchers === []) {
            return;
        }

        $this->notifications->sendMany($watchers, [
            'type' => NotificationType::VACANCY_REQUESTED,
            'title' => 'Vacancy asked for: ' . $opening->title,
            'body' => $actor->name . ' wants ' . $opening->positions . ' '
                . ($opening->positions === 1 ? 'person' : 'people') . ' in ' . $opening->location . '.'
                . ($opening->request_note === null ? '' : ' ' . $opening->request_note),
            'action_url' => '/openings',
            'entity_type' => 'job_opening',
            'entity_id' => $opening->id,
        ], $actor);
    }

    private function thankThem(
        Company $company,
        JobOpening $opening,
        Candidate $candidate,
        Application $application
    ): void {
        if ($candidate->email === null) {
            return;
        }

        try {
            Mail::to($candidate->email)->send(
                new ApplicationReceivedMail($company, $opening, $candidate, $application)
            );
        } catch (\Throwable $caught) {
            Log::warning('Application email failed: ' . $caught->getMessage());
        }
    }

    private function uniqueSlug(string $source, int $companyId, ?int $ignoreId): string
    {
        $base = Str::slug($source) ?: 'opening';
        $slug = $base;
        $suffix = 2;

        while (
            JobOpening::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('slug', $slug)
                ->where('is_active', 1)
                ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
                ->exists()
        ) {
            $slug = $base . '-' . $suffix;
            $suffix++;
        }

        return $slug;
    }

    private function uniqueKey(Company $company): string
    {
        do {
            $key = Str::slug((string) $company->slug) . '-' . Str::lower(Str::random(8));
        } while (CareerPage::query()->withoutGlobalScopes()->where('embed_key', $key)->exists());

        return $key;
    }
}

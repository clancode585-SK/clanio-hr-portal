<?php

declare(strict_types=1);

namespace App\Http\Controllers\Public;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\CareerPage;
use App\Models\Company;
use App\Models\JobOpening;
use App\Services\RecruitmentService;
use App\Support\ApiResponse;
use App\Support\CompanyTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CareerController extends Controller
{
    public function __construct(private readonly RecruitmentService $recruitment) {}

    public function openings(Request $request, string $key): JsonResponse
    {
        [$page, $company] = $this->resolve($key, $request);

        $openings = JobOpening::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('is_active', 1)
            ->where('status', JobOpening::STATUS_OPEN)
            ->where(fn ($query) => $query->whereNull('closes_on')->orWhere('closes_on', '>=', CompanyTime::date($company)))
            ->with(['department', 'branch'])
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get();

        $this->recruitment->touchPage($page, $this->domain($request));

        return ApiResponse::success([
            'company' => [
                'name' => $company->name,
                'logo_url' => $company->logo_url,
                'website' => $company->website,
            ],
            'page' => [
                'headline' => $page->headline ?: 'Current Openings',
                'intro' => $page->intro,
                'layout' => $page->layout,
                'accent_color' => $page->accent_color,
                'show_powered_by' => $page->show_powered_by,
            ],
            'openings' => $openings->map(fn (JobOpening $opening): array => $this->card($opening))->all(),
        ], 'Openings fetched successfully');
    }

    public function opening(Request $request, string $key, string $slug): JsonResponse
    {
        [$page, $company] = $this->resolve($key, $request);

        $opening = JobOpening::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('is_active', 1)
            ->where('slug', $slug)
            ->with(['department', 'branch'])
            ->first();

        if ($opening === null || ! $opening->isLive()) {
            throw new ApiException('This opening is not available.', 404, 'OPENING_NOT_FOUND');
        }

        return ApiResponse::success([
            'company' => [
                'name' => $company->name,
                'logo_url' => $company->logo_url,
            ],
            'page' => [
                'accent_color' => $page->accent_color,
                'show_powered_by' => $page->show_powered_by,
            ],
            'opening' => $this->card($opening) + [
                'summary' => $opening->summary,
                'responsibilities' => $opening->responsibilityList(),
                'requirements' => $opening->requirementList(),
                'nice_to_have' => $opening->niceToHaveList(),
                'positions' => $opening->positions,
                'closes_on' => $opening->closes_on?->toDateString(),
            ],
            'form' => $this->form(),
        ], 'Opening fetched successfully');
    }

    public function apply(Request $request, string $key, string $slug): JsonResponse
    {
        [$page, $company] = $this->resolve($key, $request);
        unset($page);

        if ($request->filled('company_website')) {
            throw new ApiException('Your application could not be accepted.', 422, 'SPAM_SUSPECTED');
        }

        $opening = JobOpening::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('is_active', 1)
            ->where('slug', $slug)
            ->first();

        if ($opening === null || ! $opening->isLive()) {
            throw new ApiException('This opening is not available.', 404, 'OPENING_NOT_FOUND');
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:200'],
            'phone' => ['required', 'string', 'min:8', 'max:20', 'regex:/^[0-9+\-\s()]+$/'],
            'total_experience' => ['nullable', 'numeric', 'between:0,60'],
            'current_company' => ['nullable', 'string', 'max:150'],
            'current_location' => ['nullable', 'string', 'max:150'],
            'current_ctc' => ['nullable', 'numeric', 'between:0,99999999'],
            'expected_ctc' => ['nullable', 'numeric', 'between:0,99999999'],
            'notice_period_days' => ['nullable', 'integer', 'between:0,365'],
            'linkedin_url' => ['nullable', 'url', 'max:255'],
            'cover_note' => ['nullable', 'string', 'max:2000'],
            'source' => ['nullable', 'string', 'max:20'],
            'resume' => ['required', 'file', 'mimes:pdf,doc,docx', 'max:5120'],
        ], [
            'resume.required' => 'Attach your resume.',
            'resume.mimes' => 'The resume must be a PDF or Word file.',
            'resume.max' => 'The resume must be 5 MB or smaller.',
            'phone.regex' => 'Enter a valid phone number.',
        ]);

        $data['source'] = in_array($data['source'] ?? '', Candidate::SOURCES, true) ? $data['source'] : 'career_page';
        $data['source_detail'] = $this->domain($request);

        $application = $this->recruitment->apply(
            $company,
            $opening,
            $data,
            $request->file('resume'),
            null,
            $request->ip()
        );

        return ApiResponse::created([
            'reference' => $application->uuid,
            'opening' => $opening->title,
        ], 'Thank you for applying for ' . $opening->title . '. The team will get back to you.');
    }

    public function intake(Request $request, string $key): JsonResponse
    {
        $page = CareerPage::query()
            ->withoutGlobalScopes()
            ->where('intake_key', $key)
            ->where('is_active', 1)
            ->first();

        if ($page === null) {
            throw new ApiException('This intake link is not active.', 404, 'INTAKE_NOT_FOUND');
        }

        $company = Company::query()->withoutGlobalScopes()->find($page->company_id);

        if ($company === null || $company->status !== 'active' || (int) $company->is_active !== 1) {
            throw new ApiException('This intake link is not active.', 404, 'INTAKE_NOT_FOUND');
        }

        $data = $request->validate([
            'opening' => ['required', 'string', 'max:200'],
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:200'],
            'phone' => ['required', 'string', 'min:8', 'max:20', 'regex:/^[0-9+\-\s()]+$/'],
            'total_experience' => ['nullable', 'numeric', 'between:0,60'],
            'current_company' => ['nullable', 'string', 'max:150'],
            'current_location' => ['nullable', 'string', 'max:150'],
            'current_ctc' => ['nullable', 'numeric', 'between:0,99999999'],
            'expected_ctc' => ['nullable', 'numeric', 'between:0,99999999'],
            'notice_period_days' => ['nullable', 'integer', 'between:0,365'],
            'linkedin_url' => ['nullable', 'url', 'max:255'],
            'resume_url' => ['nullable', 'url', 'max:255'],
            'cover_note' => ['nullable', 'string', 'max:2000'],
            'source' => ['nullable', 'string', 'max:20'],
        ], [
            'opening.required' => 'Send the opening slug or title so we know which role this is for.',
        ]);

        $needle = (string) $data['opening'];

        $opening = JobOpening::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('is_active', 1)
            ->where('status', JobOpening::STATUS_OPEN)
            ->where(fn ($query) => $query->where('slug', $needle)->orWhere('title', $needle))
            ->first();

        if ($opening === null) {
            throw new ApiException(
                'No open role matches "' . $needle . '". Use the exact title or its web address.',
                422,
                'OPENING_NOT_FOUND'
            );
        }

        $data['source'] = in_array($data['source'] ?? '', Candidate::SOURCES, true) ? $data['source'] : 'google_form';
        $data['source_detail'] = $data['resume_url'] ?? 'Google Form';

        if (($data['resume_url'] ?? null) !== null) {
            $data['cover_note'] = trim((string) ($data['cover_note'] ?? '') . "\n\nResume: " . $data['resume_url']);
        }

        $application = $this->recruitment->apply($company, $opening, $data, null, null, $request->ip());

        $page->forceFill([
            'intake_last_at' => now(),
        ])->saveQuietly();

        $page->newQuery()->withoutGlobalScopes()->whereKey($page->id)->increment('intake_count');

        return ApiResponse::created([
            'reference' => $application->uuid,
            'opening' => $opening->title,
        ], $data['name'] . ' has been added to ' . $opening->title . '.');
    }

    private function card(JobOpening $opening): array
    {
        return [
            'slug' => $opening->slug,
            'title' => $opening->title,
            'location' => $opening->location,
            'work_mode' => $opening->work_mode,
            'employment_type' => str_replace('_', ' ', (string) $opening->employment_type),
            'experience_label' => $opening->experienceLabel(),
            'department' => $opening->department?->name,
            'salary' => $opening->show_salary && $opening->salary_min !== null
                ? $this->salary($opening)
                : null,
            'published_at' => $opening->published_at?->toDateString(),
        ];
    }

    private function salary(JobOpening $opening): string
    {
        $low = number_format((float) $opening->salary_min, 0, '.', ',');

        if ($opening->salary_max === null) {
            return '₹' . $low . '+';
        }

        return '₹' . $low . ' - ₹' . number_format((float) $opening->salary_max, 0, '.', ',');
    }

    private function form(): array
    {
        return [
            ['key' => 'name', 'label' => 'Full Name', 'type' => 'text', 'required' => true],
            ['key' => 'email', 'label' => 'Email', 'type' => 'email', 'required' => true],
            ['key' => 'phone', 'label' => 'Phone', 'type' => 'tel', 'required' => true],
            ['key' => 'total_experience', 'label' => 'Total Experience (years)', 'type' => 'number', 'required' => false],
            ['key' => 'current_company', 'label' => 'Current Company', 'type' => 'text', 'required' => false],
            ['key' => 'current_location', 'label' => 'Current Location', 'type' => 'text', 'required' => false],
            ['key' => 'current_ctc', 'label' => 'Current CTC', 'type' => 'number', 'required' => false],
            ['key' => 'expected_ctc', 'label' => 'Expected CTC', 'type' => 'number', 'required' => false],
            ['key' => 'notice_period_days', 'label' => 'Notice Period (days)', 'type' => 'number', 'required' => false],
            ['key' => 'linkedin_url', 'label' => 'LinkedIn Profile', 'type' => 'url', 'required' => false],
            ['key' => 'resume', 'label' => 'Resume', 'type' => 'file', 'required' => true, 'accept' => '.pdf,.doc,.docx'],
            ['key' => 'cover_note', 'label' => 'Anything else we should know?', 'type' => 'textarea', 'required' => false],
        ];
    }

    /**
     * @return array{0: CareerPage, 1: Company}
     */
    private function resolve(string $key, Request $request): array
    {
        $page = CareerPage::query()
            ->withoutGlobalScopes()
            ->where('embed_key', $key)
            ->where('is_active', 1)
            ->first();

        if ($page === null) {
            throw new ApiException('This career page is not available.', 404, 'CAREER_PAGE_NOT_FOUND');
        }

        $domain = $this->domain($request);

        if (! $page->allows($domain)) {
            throw new ApiException('This career page cannot be shown on ' . $domain . '.', 403, 'DOMAIN_NOT_ALLOWED');
        }

        $company = Company::query()->withoutGlobalScopes()->find($page->company_id);

        if ($company === null || $company->status !== 'active' || (int) $company->is_active !== 1) {
            throw new ApiException('This career page is not available.', 404, 'CAREER_PAGE_NOT_FOUND');
        }

        return [$page, $company];
    }

    private function domain(Request $request): ?string
    {
        $origin = $request->headers->get('origin') ?? $request->headers->get('referer');

        if ($origin === null) {
            return null;
        }

        return parse_url($origin, PHP_URL_HOST) ?: null;
    }
}

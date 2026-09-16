<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Models\Application;
use App\Models\CareerPage;
use App\Models\Company;
use App\Models\JobOpening;
use App\Services\RecruitmentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CareerPageController extends ApiController
{
    public function __construct(private readonly RecruitmentService $recruitment) {}

    public function show(Request $request): JsonResponse
    {
        return ApiResponse::success($this->shape($this->page($request)), 'Career page fetched successfully');
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'headline' => ['nullable', 'string', 'max:150'],
            'intro' => ['nullable', 'string', 'max:1000'],
            'layout' => ['sometimes', Rule::in(CareerPage::LAYOUTS)],
            'accent_color' => ['sometimes', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'show_powered_by' => ['sometimes', 'boolean'],
            'allowed_domains' => ['nullable', 'string', 'max:500'],
        ], [
            'accent_color.regex' => 'Use a colour like #1B2A6B.',
        ]);

        $page = $this->page($request);
        $page->fill($data);
        $page->updated_by = $request->user()->id;
        $page->save();

        return ApiResponse::success($this->shape($page->refresh()), 'Career page updated successfully');
    }

    public function regenerate(Request $request): JsonResponse
    {
        $page = $this->page($request);

        $page->forceFill([
            'embed_key' => $this->freshKey($page),
            'connected_at' => null,
            'last_seen_at' => null,
            'last_seen_domain' => null,
            'updated_by' => $request->user()->id,
        ])->save();

        return ApiResponse::success(
            $this->shape($page->refresh()),
            'New snippet issued. Replace the old one on your website.'
        );
    }

    private function page(Request $request): CareerPage
    {
        $companyId = $this->tenantId();

        if ($companyId === null) {
            throw new ApiException(
                'A career page belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        $company = Company::query()->withoutGlobalScopes()->findOrFail($companyId);

        return $this->recruitment->pageFor($company, $request->user());
    }

    private function shape(CareerPage $page): array
    {
        $base = rtrim((string) config('app.url'), '/');
        $live = JobOpening::query()->where('status', JobOpening::STATUS_OPEN)->count();

        return [
            'uuid' => $page->uuid,
            'embed_key' => $page->embed_key,
            'headline' => $page->headline,
            'intro' => $page->intro,
            'layout' => $page->layout,
            'accent_color' => $page->accent_color,
            'show_powered_by' => $page->show_powered_by,
            'allowed_domains' => $page->allowed_domains,
            'is_connected' => $page->isConnected(),
            'connected_at' => $page->connected_at?->toIso8601String(),
            'last_seen_at' => $page->last_seen_at?->toIso8601String(),
            'last_seen_domain' => $page->last_seen_domain,
            'view_count' => $page->view_count,
            'live_openings' => $live,
            'total_applications' => Application::query()->count(),
            'hosted_url' => $base . '/careers/' . $page->embed_key,
            'feed_url' => $base . '/careers/' . $page->embed_key . '/feed.xml',
            'snippet' => '<div id="clanio-careers" data-key="' . $page->embed_key . '"></div>' . "\n"
                . '<script src="' . $base . '/embed.js" async></script>',
            'intake_key' => $page->intake_key,
            'intake_url' => $base . '/api/hrms/intake/' . $page->intake_key,
            'intake_count' => $page->intake_count,
            'intake_last_at' => $page->intake_last_at?->toIso8601String(),
            'intake_script' => $this->appsScript($base, (string) $page->intake_key),
        ];
    }

    private function appsScript(string $base, string $key): string
    {
        return <<<SCRIPT
        function onFormSubmit(e) {
          var answers = {}
          e.namedValues && Object.keys(e.namedValues).forEach(function (label) {
            answers[label.trim().toLowerCase()] = String(e.namedValues[label]).trim()
          })

          var pick = function (names) {
            for (var i = 0; i < names.length; i++) {
              if (answers[names[i]]) return answers[names[i]]
            }
            return ''
          }

          var body = {
            opening: pick(['which role', 'role', 'position', 'opening']),
            name: pick(['full name', 'name']),
            email: pick(['email', 'email address']),
            phone: pick(['phone', 'phone number', 'mobile']),
            total_experience: pick(['total experience', 'experience']),
            current_company: pick(['current company', 'company']),
            current_location: pick(['current location', 'location']),
            expected_ctc: pick(['expected ctc', 'expected salary']),
            notice_period_days: pick(['notice period', 'notice period (days)']),
            linkedin_url: pick(['linkedin', 'linkedin profile']),
            resume_url: pick(['resume', 'upload resume', 'cv']),
            cover_note: pick(['anything else', 'cover note', 'message'])
          }

          Object.keys(body).forEach(function (k) { if (!body[k]) delete body[k] })

          UrlFetchApp.fetch('{$base}/api/hrms/intake/{$key}', {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(body),
            muteHttpExceptions: true
          })
        }
        SCRIPT;
    }

    private function freshKey(CareerPage $page): string
    {
        $slug = (string) ($page->company?->slug ?? 'careers');

        do {
            $key = $slug . '-' . strtolower(bin2hex(random_bytes(4)));
        } while (CareerPage::query()->withoutGlobalScopes()->where('embed_key', $key)->exists());

        return $key;
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Public;

use App\Models\CareerPage;
use App\Models\Company;
use App\Models\JobOpening;
use App\Services\RecruitmentService;
use App\Support\CompanyTime;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CareerPageWebController extends \App\Http\Controllers\Controller
{
    public function __construct(private readonly RecruitmentService $recruitment) {}

    public function index(Request $request, string $key): View
    {
        [$page, $company] = $this->resolve($key);

        $openings = $this->liveQuery($company)->with(['department', 'branch'])->get();

        $this->recruitment->touchPage($page, $request->getHost());

        return view('careers.index', [
            'page' => $page,
            'company' => $company,
            'openings' => $openings,
            'apiBase' => rtrim((string) config('app.url'), '/') . '/api/hrms',
        ]);
    }

    public function opening(Request $request, string $key, string $slug): View
    {
        [$page, $company] = $this->resolve($key);

        $opening = $this->liveQuery($company)->where('slug', $slug)->with(['department', 'branch'])->first();

        if ($opening === null) {
            throw new NotFoundHttpException('This opening is no longer listed.');
        }

        return view('careers.opening', [
            'page' => $page,
            'company' => $company,
            'opening' => $opening,
            'apiBase' => rtrim((string) config('app.url'), '/') . '/api/hrms',
            'jsonLd' => $this->jsonLd($opening, $company),
        ]);
    }

    public function feed(string $key): Response
    {
        [$page, $company] = $this->resolve($key);

        $xml = view('careers.feed', [
            'company' => $company,
            'openings' => $this->liveQuery($company)->with(['department', 'branch'])->get(),
            'link' => fn (JobOpening $opening): string => route('careers.opening', [
                'key' => $page->embed_key,
                'slug' => $opening->slug,
            ]),
        ])->render();

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=1800',
        ]);
    }

    public function embed(): Response
    {
        $script = view('careers.embed', [
            'apiBase' => rtrim((string) config('app.url'), '/') . '/api/hrms',
            'hostBase' => rtrim((string) config('app.url'), '/'),
        ])->render();

        return response($script, 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'public, max-age=300',
            'Access-Control-Allow-Origin' => '*',
        ]);
    }

    private function liveQuery(Company $company)
    {
        return JobOpening::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('is_active', 1)
            ->where('status', JobOpening::STATUS_OPEN)
            ->where(fn ($query) => $query->whereNull('closes_on')->orWhere('closes_on', '>=', CompanyTime::date($company)))
            ->orderByDesc('published_at')
            ->orderByDesc('id');
    }

    /**
     * @return array{0: CareerPage, 1: Company}
     */
    private function resolve(string $key): array
    {
        $page = CareerPage::query()
            ->withoutGlobalScopes()
            ->where('embed_key', $key)
            ->where('is_active', 1)
            ->first();

        if ($page === null) {
            throw new NotFoundHttpException('This career page is not available.');
        }

        $company = Company::query()->withoutGlobalScopes()->find($page->company_id);

        if ($company === null || $company->status !== 'active' || (int) $company->is_active !== 1) {
            throw new NotFoundHttpException('This career page is not available.');
        }

        return [$page, $company];
    }

    private function jsonLd(JobOpening $opening, Company $company): string
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'JobPosting',
            'title' => $opening->title,
            'description' => $this->descriptionHtml($opening),
            'datePosted' => $opening->published_at?->toDateString(),
            'employmentType' => strtoupper(str_replace('_', '_', (string) $opening->employment_type)),
            'hiringOrganization' => [
                '@type' => 'Organization',
                'name' => $company->name,
                'sameAs' => $company->website,
                'logo' => $company->logo_url,
            ],
            'jobLocation' => [
                '@type' => 'Place',
                'address' => [
                    '@type' => 'PostalAddress',
                    'addressLocality' => $opening->location,
                    'addressCountry' => 'IN',
                ],
            ],
            'totalJobOpenings' => $opening->positions,
        ];

        if ($opening->closes_on !== null) {
            $data['validThrough'] = $opening->closes_on->toDateString();
        }

        if ($opening->work_mode === 'remote') {
            $data['jobLocationType'] = 'TELECOMMUTE';
        }

        if ($opening->show_salary && $opening->salary_min !== null) {
            $data['baseSalary'] = [
                '@type' => 'MonetaryAmount',
                'currency' => 'INR',
                'value' => [
                    '@type' => 'QuantitativeValue',
                    'minValue' => $opening->salary_min,
                    'maxValue' => $opening->salary_max ?? $opening->salary_min,
                    'unitText' => 'YEAR',
                ],
            ];
        }

        return (string) json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private function descriptionHtml(JobOpening $opening): string
    {
        $parts = [];

        if ($opening->summary !== null) {
            $parts[] = '<p>' . e($opening->summary) . '</p>';
        }

        foreach ([
            'Key Responsibilities' => $opening->responsibilityList(),
            'Required Skills and Qualifications' => $opening->requirementList(),
            'Good to have' => $opening->niceToHaveList(),
        ] as $heading => $lines) {
            if ($lines === []) {
                continue;
            }

            $parts[] = '<h3>' . $heading . '</h3><ul>'
                . implode('', array_map(static fn (string $line): string => '<li>' . e($line) . '</li>', $lines))
                . '</ul>';
        }

        return implode('', $parts);
    }
}

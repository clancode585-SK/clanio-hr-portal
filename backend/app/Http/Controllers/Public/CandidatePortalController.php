<?php

declare(strict_types=1);

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Candidate;
use App\Models\CareerPage;
use App\Models\Company;
use App\Models\OfferLetter;
use App\Models\User;
use App\Services\OfferLetterService;
use App\Support\CompanyTime;
use Carbon\Carbon;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CandidatePortalController extends Controller
{
    public function __construct(private readonly OfferLetterService $offers) {}

    public function show(string $token): View
    {
        [$candidate, $company, $page] = $this->resolve($token);

        $candidate->forceFill([
            'portal_opened_at' => $candidate->portal_opened_at ?? Carbon::now(),
            'portal_last_seen_at' => Carbon::now(),
        ])->saveQuietly();

        $candidate->newQuery()->withoutGlobalScopes()->whereKey($candidate->id)->increment('portal_visits');

        $applications = Application::query()
            ->withoutGlobalScopes()
            ->where('candidate_id', $candidate->id)
            ->where('is_active', 1)
            ->with([
                'opening' => fn ($query) => $query->withoutGlobalScopes(),
                'offerLetter' => fn ($query) => $query->withoutGlobalScopes(),
                'interviews' => fn ($query) => $query->withoutGlobalScopes()->orderBy('round_no'),
            ])
            ->latest('id')
            ->get();

        return view('careers.track', [
            'candidate' => $candidate,
            'company' => $company,
            'page' => $page,
            'applications' => $applications,
            'steps' => $this->steps(),
            'zone' => CompanyTime::zone($company),
        ]);
    }

    public function answer(Request $request, string $token): RedirectResponse
    {
        [$candidate] = $this->resolve($token);

        $data = $request->validate([
            'letter' => ['required', 'string'],
            'decision' => ['required', 'in:accepted,declined'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $letter = OfferLetter::query()
            ->withoutGlobalScopes()
            ->where('uuid', $data['letter'])
            ->where('is_active', 1)
            ->whereHas(
                'application',
                fn ($query) => $query->withoutGlobalScopes()->where('candidate_id', $candidate->id)
            )
            ->first();

        if ($letter === null) {
            throw new NotFoundHttpException('That offer is not on your record.');
        }

        $application = Application::query()
            ->withoutGlobalScopes()
            ->whereKey($letter->application_id)
            ->first();

        $letter->setRelation('application', $application);

        if (! $letter->isOpen()) {
            return redirect($candidate->portalPath())->with('problem', 'This offer has already been answered.');
        }

        if ($letter->hasLapsed()) {
            return redirect($candidate->portalPath())->with(
                'problem',
                'The reply-by date has passed. Please write to the company.'
            );
        }

        if ($data['decision'] === OfferLetter::STATUS_DECLINED && ($data['reason'] ?? null) === null) {
            return redirect($candidate->portalPath())->with('problem', 'Please tell us why you are turning it down.');
        }

        $actor = User::query()->withoutGlobalScopes()->find($letter->signed_by);

        if ($actor === null) {
            throw new NotFoundHttpException('This offer cannot be answered right now.');
        }

        $this->offers->answer($letter, $data['decision'], $data['reason'] ?? null, $actor);

        $letter->forceFill(['answered_by_candidate' => true])->saveQuietly();

        return redirect($candidate->portalPath())->with(
            'done',
            $data['decision'] === OfferLetter::STATUS_ACCEPTED
                ? 'Thank you. The team has been told that you accepted.'
                : 'Thank you for letting us know.'
        );
    }

    /**
     * @return array{0: Candidate, 1: Company, 2: CareerPage|null}
     */
    private function resolve(string $token): array
    {
        $candidate = Candidate::query()
            ->withoutGlobalScopes()
            ->where('portal_token', $token)
            ->where('is_active', 1)
            ->first();

        if ($candidate === null) {
            throw new NotFoundHttpException('This tracking link is not valid.');
        }

        $company = Company::query()->withoutGlobalScopes()->find($candidate->company_id);

        if ($company === null || $company->status !== 'active' || (int) $company->is_active !== 1) {
            throw new NotFoundHttpException('This tracking link is not valid.');
        }

        $page = CareerPage::query()->withoutGlobalScopes()->where('company_id', $company->id)->first();

        return [$candidate, $company, $page];
    }

    private function steps(): array
    {
        return [
            Application::STAGE_APPLIED => 'Application received',
            Application::STAGE_SCREENING => 'Being screened',
            Application::STAGE_INTERVIEW => 'Interviews',
            Application::STAGE_OFFER => 'Offer',
            Application::STAGE_JOINED => 'Joined',
        ];
    }
}

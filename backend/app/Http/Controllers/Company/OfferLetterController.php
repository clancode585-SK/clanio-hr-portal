<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Resources\OfferLetterResource;
use App\Models\Application;
use App\Models\OfferLetter;
use App\Services\OfferLetterService;
use App\Support\ApiResponse;
use App\Support\CompanyTime;
use App\Support\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OfferLetterController extends ApiController
{
    public function __construct(private readonly OfferLetterService $offers) {}

    public function index(Request $request): JsonResponse
    {
        $letters = $this->applyFilters(
            OfferLetter::query()->with(['application.candidate', 'application.opening', 'signer']),
            $request,
            ['letter_number', 'candidate_name', 'role_title'],
            ['status' => 'status']
        )->latest('id')->paginate($this->perPage($request));

        return ApiResponse::paginated($letters, OfferLetterResource::class, 'Offer letters fetched successfully');
    }

    public function forApplication(Application $application): JsonResponse
    {
        $letter = OfferLetter::query()
            ->where('application_id', $application->id)
            ->with(['application.candidate', 'application.opening', 'signer'])
            ->first();

        return ApiResponse::success(
            $letter === null ? null : new OfferLetterResource($letter),
            'Offer letter fetched successfully'
        );
    }

    public function store(Request $request, Application $application): JsonResponse
    {
        $data = $request->validate([
            'annual_ctc' => ['required', 'numeric', 'between:1,99999999'],
            'joining_date' => ['required', 'date', 'after_or_equal:today'],
            'designation' => ['nullable', 'string', 'max:150'],
            'department' => ['nullable', 'string', 'max:150'],
            'location' => ['nullable', 'string', 'max:150'],
            'employment_type' => ['nullable', 'string', 'max:20'],
            'reporting_to' => ['nullable', 'string', 'max:150'],
            'probation_months' => ['nullable', 'integer', 'between:0,24'],
            'notice_days' => ['nullable', 'integer', 'between:0,180'],
            'valid_till' => ['nullable', 'date', 'after_or_equal:today'],
            'extra_terms' => ['nullable', 'string', 'max:4000'],
        ], [
            'joining_date.after_or_equal' => 'The joining date cannot be in the past.',
            'valid_till.after_or_equal' => 'The reply-by date cannot be in the past.',
        ]);

        $letter = $this->offers->issue($application, $data, $request->user());

        return ApiResponse::created(
            new OfferLetterResource($letter->load(['application.candidate', 'application.opening', 'signer'])),
            'Offer letter ' . $letter->letter_number . ' raised and emailed to the candidate.'
        );
    }

    public function answer(Request $request, OfferLetter $letter): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in([OfferLetter::STATUS_ACCEPTED, OfferLetter::STATUS_DECLINED])],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $updated = $this->offers->answer($letter, $data['status'], $data['reason'] ?? null, $request->user());

        return ApiResponse::success(
            new OfferLetterResource($updated->load(['application.candidate', 'application.opening', 'signer'])),
            $updated->candidate_name . ' ' . ($data['status'] === OfferLetter::STATUS_ACCEPTED ? 'accepted' : 'turned down')
                . ' the offer'
        );
    }

    public function withdraw(Request $request, OfferLetter $letter): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        return ApiResponse::success(
            new OfferLetterResource(
                $this->offers->withdraw($letter, $data['reason'] ?? null, $request->user())
                    ->load(['application.candidate', 'application.opening', 'signer'])
            ),
            'Offer pulled back'
        );
    }

    public function preview(OfferLetter $letter): Response
    {
        return Pdf::show($this->offers->pdf($letter), $letter->letter_number . '.pdf');
    }

    public function download(OfferLetter $letter): StreamedResponse
    {
        return Pdf::send($this->offers->pdf($letter), $letter->letter_number . '.pdf');
    }

    public function summary(): JsonResponse
    {
        $base = OfferLetter::query();

        return ApiResponse::success([
            'issued' => (clone $base)->where('status', OfferLetter::STATUS_ISSUED)->count(),
            'accepted' => (clone $base)->where('status', OfferLetter::STATUS_ACCEPTED)->count(),
            'declined' => (clone $base)->where('status', OfferLetter::STATUS_DECLINED)->count(),
            'withdrawn' => (clone $base)->where('status', OfferLetter::STATUS_WITHDRAWN)->count(),
            'lapsed' => (clone $base)
                ->where('status', OfferLetter::STATUS_ISSUED)
                ->whereNotNull('valid_till')
                ->whereDate('valid_till', '<', CompanyTime::date())
                ->count(),
            'waiting_value' => round((float) (clone $base)
                ->where('status', OfferLetter::STATUS_ISSUED)
                ->sum('annual_ctc'), 2),
        ], 'Offer summary fetched successfully');
    }
}

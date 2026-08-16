<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\AppraisalCycleRequest;
use App\Http\Requests\AppraisalReviewRequest;
use App\Http\Resources\AppraisalCycleResource;
use App\Http\Resources\AppraisalResource;
use App\Models\Appraisal;
use App\Models\AppraisalCycle;
use App\Services\AppraisalService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppraisalController extends ApiController
{
    public function __construct(private readonly AppraisalService $appraisals) {}

    /* --------------------------------------------------------------- cycles */

    public function cycles(Request $request): JsonResponse
    {
        $cycles = $this->applyFilters(
            AppraisalCycle::query()->withCount('appraisals'),
            $request,
            ['name'],
            ['status' => 'status']
        )->orderByDesc('period_start')->paginate($this->perPage($request));

        return ApiResponse::paginated($cycles, AppraisalCycleResource::class, 'Appraisal cycles fetched successfully');
    }

    public function storeCycle(AppraisalCycleRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new AppraisalCycleResource($this->appraisals->createCycle($request->user(), $request->validated())),
            'Appraisal cycle ban gayi'
        );
    }

    public function showCycle(AppraisalCycle $cycle): JsonResponse
    {
        return ApiResponse::success(
            new AppraisalCycleResource($cycle->loadCount('appraisals')),
            'Appraisal cycle fetched successfully'
        );
    }

    public function updateCycle(AppraisalCycleRequest $request, AppraisalCycle $cycle): JsonResponse
    {
        return ApiResponse::success(
            new AppraisalCycleResource($this->appraisals->updateCycle($cycle, $request->validated(), $request->user())),
            'Cycle update ho gayi'
        );
    }

    public function launchCycle(Request $request, AppraisalCycle $cycle): JsonResponse
    {
        return ApiResponse::success(
            new AppraisalCycleResource($this->appraisals->launch($cycle, $request->user())),
            'Cycle launch ho gayi — sabke appraisal ban gaye'
        );
    }

    public function advanceCycle(AppraisalCycleRequest $request, AppraisalCycle $cycle): JsonResponse
    {
        return ApiResponse::success(
            new AppraisalCycleResource(
                $this->appraisals->advanceCycle($cycle, $request->validated()['status'], $request->user())
            ),
            'Cycle agle stage par chali gayi'
        );
    }

    public function cycleSummary(Request $request, AppraisalCycle $cycle): JsonResponse
    {
        return ApiResponse::success(
            $this->appraisals->cycleSummary($cycle, $request->user()),
            'Cycle summary fetched successfully'
        );
    }

    /* ----------------------------------------------------------- appraisals */

    public function index(Request $request): JsonResponse
    {
        $appraisals = $this->applyFilters(
            Appraisal::query()
                ->with(['employee.user', 'cycle', 'manager', 'hr'])
                ->visibleTo($request->user()),
            $request,
            [],
            [
                'status' => 'status',
                'appraisal_cycle_id' => 'appraisal_cycle_id',
                'employee_id' => 'employee_id',
            ]
        )
            ->orderByRaw("FIELD(status, 'pending', 'self_done', 'manager_done', 'finalised')")
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($appraisals, AppraisalResource::class, 'Appraisals fetched successfully');
    }

    public function pendingReviews(Request $request): JsonResponse
    {
        $appraisals = Appraisal::query()
            ->with(['employee.user', 'cycle', 'manager'])
            ->where('manager_id', $request->user()->id)
            ->where('status', Appraisal::SELF_DONE)
            ->visibleTo($request->user())
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($appraisals, AppraisalResource::class, 'Pending reviews fetched successfully');
    }

    public function show(Appraisal $appraisal): JsonResponse
    {
        return ApiResponse::success(
            new AppraisalResource($appraisal->load('employee.user', 'cycle', 'manager', 'hr')),
            'Appraisal fetched successfully'
        );
    }

    public function selfReview(AppraisalReviewRequest $request, Appraisal $appraisal): JsonResponse
    {
        return ApiResponse::success(
            new AppraisalResource($this->appraisals->selfReview($appraisal, $request->validated(), $request->user())),
            'Self review bhej diya gaya'
        );
    }

    public function managerReview(AppraisalReviewRequest $request, Appraisal $appraisal): JsonResponse
    {
        return ApiResponse::success(
            new AppraisalResource($this->appraisals->managerReview($appraisal, $request->validated(), $request->user())),
            'Manager review ho gaya'
        );
    }

    public function finalise(AppraisalReviewRequest $request, Appraisal $appraisal): JsonResponse
    {
        return ApiResponse::success(
            new AppraisalResource($this->appraisals->finalise($appraisal, $request->validated(), $request->user())),
            'Final rating de di gayi'
        );
    }
}

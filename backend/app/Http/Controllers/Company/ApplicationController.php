<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Resources\ApplicationResource;
use App\Http\Resources\CandidateResource;
use App\Models\Application;
use App\Models\Candidate;
use App\Models\JobOpening;
use App\Services\RecruitmentService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApplicationController extends ApiController
{
    public function __construct(private readonly RecruitmentService $recruitment) {}

    public function index(Request $request): JsonResponse
    {
        $applications = $this->applyFilters(
            Application::query()
                ->with(['opening', 'candidate', 'movedBy'])
                ->when(
                    $request->filled('opening'),
                    fn (Builder $query): Builder => $query->whereHas(
                        'opening',
                        fn (Builder $inner): Builder => $inner->where('uuid', $request->string('opening')->toString())
                    )
                )
                ->when(
                    $request->filled('search'),
                    fn (Builder $query): Builder => $query->whereHas(
                        'candidate',
                        function (Builder $inner) use ($request): Builder {
                            $term = '%' . $request->string('search')->toString() . '%';

                            return $inner->where(
                                fn (Builder $where): Builder => $where
                                    ->where('name', 'like', $term)
                                    ->orWhere('email', 'like', $term)
                                    ->orWhere('phone', 'like', $term)
                            );
                        }
                    )
                ),
            $request,
            [],
            ['stage' => 'stage', 'source' => 'source', 'job_opening_id' => 'job_opening_id']
        )->latest('id')->paginate($this->perPage($request));

        return ApiResponse::paginated($applications, ApplicationResource::class, 'Applications fetched successfully');
    }

    public function show(Application $application): JsonResponse
    {
        return ApiResponse::success(
            new ApplicationResource($application->load(['opening', 'candidate', 'movedBy'])),
            'Application fetched successfully'
        );
    }

    public function move(Request $request, Application $application): JsonResponse
    {
        $data = $request->validate([
            'stage' => ['required', Rule::in(Application::STAGES)],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'rejection_reason' => ['nullable', 'string', 'max:255'],
            'offered_ctc' => ['nullable', 'numeric', 'between:0,99999999'],
            'offer_date' => ['nullable', 'date'],
            'joining_date' => ['nullable', 'date'],
        ]);

        $moved = $this->recruitment->moveStage($application, $data, $request->user());

        return ApiResponse::success(
            new ApplicationResource($moved->load(['opening', 'candidate', 'movedBy'])),
            'Moved to ' . str_replace('_', ' ', $moved->stage)
        );
    }

    public function bulkMove(Request $request): JsonResponse
    {
        $data = $request->validate([
            'uuids' => ['required', 'array', 'min:1', 'max:100'],
            'uuids.*' => ['required', 'string'],
            'stage' => ['required', Rule::in([
                Application::STAGE_SCREENING,
                Application::STAGE_INTERVIEW,
                Application::STAGE_REJECTED,
            ])],
            'rejection_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $moved = 0;
        $skipped = [];

        foreach (Application::query()->whereIn('uuid', $data['uuids'])->get() as $application) {
            try {
                $this->recruitment->moveStage($application, $data, $request->user());
                $moved++;
            } catch (\Throwable $caught) {
                $skipped[] = ['uuid' => $application->uuid, 'reason' => $caught->getMessage()];
            }
        }

        return ApiResponse::success(
            ['moved' => $moved, 'skipped' => $skipped],
            $moved . ' ' . ($moved === 1 ? 'candidate' : 'candidates') . ' moved to ' . str_replace('_', ' ', $data['stage'])
        );
    }

    public function resume(Candidate $candidate): StreamedResponse
    {
        return $this->recruitment->resume($candidate);
    }

    public function candidates(Request $request): JsonResponse
    {
        $candidates = $this->applyFilters(
            Candidate::query()->with('referrer')->withCount('applications'),
            $request,
            ['name', 'email', 'phone', 'current_company'],
            ['source' => 'source']
        )->latest('id')->paginate($this->perPage($request));

        return ApiResponse::paginated($candidates, CandidateResource::class, 'Candidates fetched successfully');
    }

    public function openingApplications(Request $request, JobOpening $opening): JsonResponse
    {
        $applications = $opening->applications()
            ->with(['candidate', 'movedBy'])
            ->when(
                $request->filled('stage'),
                fn (Builder $query): Builder => $query->where('stage', $request->string('stage')->toString())
            )
            ->latest('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($applications, ApplicationResource::class, 'Applications fetched successfully');
    }
}

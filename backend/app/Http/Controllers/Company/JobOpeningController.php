<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\JobOpeningRequest;
use App\Http\Resources\JobOpeningResource;
use App\Models\Application;
use App\Models\JobOpening;
use App\Services\RecruitmentService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobOpeningController extends ApiController
{
    public function __construct(private readonly RecruitmentService $recruitment) {}

    public function index(Request $request): JsonResponse
    {
        $openings = $this->applyFilters(
            JobOpening::query()
                ->with(['department', 'designation', 'branch'])
                ->withCount([
                    'applications',
                    'applications as open_applications_count' => fn (Builder $query): Builder => $query
                        ->whereIn('stage', Application::OPEN_STAGES),
                ]),
            $request,
            ['title', 'location'],
            ['status' => 'status', 'department_id' => 'department_id', 'employment_type' => 'employment_type']
        )->latest('id')->paginate($this->perPage($request));

        return ApiResponse::paginated($openings, JobOpeningResource::class, 'Openings fetched successfully');
    }

    public function summary(): JsonResponse
    {
        $base = JobOpening::query();

        return ApiResponse::success([
            'open' => (clone $base)->where('status', JobOpening::STATUS_OPEN)->count(),
            'draft' => (clone $base)->where('status', JobOpening::STATUS_DRAFT)->count(),
            'on_hold' => (clone $base)->where('status', JobOpening::STATUS_ON_HOLD)->count(),
            'closed' => (clone $base)->where('status', JobOpening::STATUS_CLOSED)->count(),
            'positions' => (int) (clone $base)->where('status', JobOpening::STATUS_OPEN)->sum('positions'),
            'applications' => Application::query()->count(),
            'in_process' => Application::query()->whereIn('stage', Application::OPEN_STAGES)->count(),
            'new_applications' => Application::query()->where('stage', Application::STAGE_APPLIED)->count(),
        ], 'Recruitment summary fetched successfully');
    }

    public function store(JobOpeningRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new JobOpeningResource($this->recruitment->createOpening(
                $request->validated(),
                $request->user(),
                $this->tenantId()
            )->load(['department', 'designation', 'branch'])),
            'Opening created successfully'
        );
    }

    public function request(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'location' => ['required', 'string', 'max:150'],
            'positions' => ['sometimes', 'integer', 'between:1,999'],
            'department_id' => ['nullable', 'integer'],
            'designation_id' => ['nullable', 'integer'],
            'employment_type' => ['sometimes', 'string', 'max:20'],
            'experience_min' => ['sometimes', 'numeric', 'between:0,50'],
            'experience_max' => ['nullable', 'numeric', 'between:0,60'],
            'request_note' => ['required', 'string', 'min:10', 'max:1000'],
        ], [
            'request_note.required' => 'Say why this person is needed — HR reads this before approving.',
            'request_note.min' => 'A line or two on why, please.',
        ]);

        return ApiResponse::created(
            new JobOpeningResource($this->recruitment->requestOpening(
                $data,
                $request->user(),
                $this->tenantId()
            )->load(['department', 'designation', 'requester'])),
            'Vacancy asked for. HR will take it from here.'
        );
    }

    public function decide(Request $request, JobOpening $opening): JsonResponse
    {
        $data = $request->validate([
            'approve' => ['required', 'boolean'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $decided = $this->recruitment->decideRequest(
            $opening,
            (bool) $data['approve'],
            $data['reason'] ?? null,
            $request->user()
        );

        return ApiResponse::success(
            new JobOpeningResource($decided->load(['department', 'designation', 'requester', 'approver'])),
            $data['approve']
                ? 'Approved. Write the description and publish it when ready.'
                : 'Turned down. The person who asked has been told.'
        );
    }

    public function show(JobOpening $opening): JsonResponse
    {
        $opening->loadCount([
            'applications',
            'applications as open_applications_count' => fn (Builder $query): Builder => $query
                ->whereIn('stage', Application::OPEN_STAGES),
        ]);

        return ApiResponse::success(
            new JobOpeningResource($opening->load(['department', 'designation', 'branch'])),
            'Opening fetched successfully'
        );
    }

    public function update(JobOpeningRequest $request, JobOpening $opening): JsonResponse
    {
        return ApiResponse::success(
            new JobOpeningResource(
                $this->recruitment->updateOpening($opening, $request->validated(), $request->user())
                    ->load(['department', 'designation', 'branch'])
            ),
            'Opening updated successfully'
        );
    }

    public function destroy(JobOpening $opening): JsonResponse
    {
        $this->recruitment->deleteOpening($opening);

        return ApiResponse::success(null, 'Opening removed');
    }

    public function pipeline(JobOpening $opening): JsonResponse
    {
        $counts = $opening->applications()
            ->selectRaw('stage, COUNT(*) AS total')
            ->groupBy('stage')
            ->pluck('total', 'stage');

        return ApiResponse::success(
            array_map(static fn (string $stage): array => [
                'stage' => $stage,
                'label' => ucfirst(str_replace('_', ' ', $stage)),
                'total' => (int) ($counts[$stage] ?? 0),
            ], Application::STAGES),
            'Pipeline fetched successfully'
        );
    }
}

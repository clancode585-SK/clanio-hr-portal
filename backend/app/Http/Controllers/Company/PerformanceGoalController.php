<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\GoalProgressRequest;
use App\Http\Requests\PerformanceGoalRequest;
use App\Http\Resources\PerformanceGoalResource;
use App\Models\PerformanceGoal;
use App\Services\GoalService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PerformanceGoalController extends ApiController
{
    public function __construct(private readonly GoalService $goals) {}

    public function index(Request $request): JsonResponse
    {
        $goals = $this->applyFilters(
            PerformanceGoal::query()
                ->with(['employee.user', 'approver', 'keyResults'])
                ->withCount('keyResults')
                ->whereNull('parent_id')
                ->visibleTo($request->user()),
            $request,
            ['title', 'metric'],
            [
                'status' => 'status',
                'goal_type' => 'goal_type',
                'employee_id' => 'employee_id',
                'appraisal_cycle_id' => 'appraisal_cycle_id',
            ]
        )
            ->orderByRaw("FIELD(status, 'draft', 'active', 'achieved', 'missed', 'cancelled')")
            ->orderBy('due_date')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($goals, PerformanceGoalResource::class, 'Goals fetched successfully');
    }

    public function types(): JsonResponse
    {
        return ApiResponse::success([
            'goal_types' => [
                ['value' => PerformanceGoal::TYPE_KRA, 'label' => 'KRA / Target — standalone'],
                ['value' => PerformanceGoal::TYPE_OBJECTIVE, 'label' => 'Objective — OKR ka O'],
                ['value' => PerformanceGoal::TYPE_KEY_RESULT, 'label' => 'Key Result — OKR ka KR'],
            ],
            'progress_sources' => PerformanceGoal::SOURCES,
            'statuses' => PerformanceGoal::STATUSES,
        ], 'Goal types fetched successfully');
    }

    public function pendingApprovals(Request $request): JsonResponse
    {
        $goals = PerformanceGoal::query()
            ->with(['employee.user', 'keyResults'])
            ->whereNull('parent_id')
            ->where('status', PerformanceGoal::DRAFT)
            ->visibleTo($request->user())
            ->whereHas('employee', fn (Builder $query) => $query->where('user_id', '!=', $request->user()->id))
            ->orderBy('due_date')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($goals, PerformanceGoalResource::class, 'Pending goal approvals fetched successfully');
    }

    public function store(PerformanceGoalRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new PerformanceGoalResource($this->goals->create($request->user(), $request->validated())),
            'Goal ban gaya — manager approve karega'
        );
    }

    public function show(PerformanceGoal $goal): JsonResponse
    {
        return ApiResponse::success(
            new PerformanceGoalResource(
                $goal->load('employee.user', 'approver', 'keyResults', 'tasks', 'cycle')
            ),
            'Goal details fetched successfully'
        );
    }

    public function update(PerformanceGoalRequest $request, PerformanceGoal $goal): JsonResponse
    {
        return ApiResponse::success(
            new PerformanceGoalResource($this->goals->update($goal, $request->validated(), $request->user())),
            'Goal update ho gaya'
        );
    }

    public function approve(Request $request, PerformanceGoal $goal): JsonResponse
    {
        return ApiResponse::success(
            new PerformanceGoalResource($this->goals->approve($goal, $request->user())),
            'Goal approve ho gaya'
        );
    }

    public function progress(GoalProgressRequest $request, PerformanceGoal $goal): JsonResponse
    {
        return ApiResponse::success(
            new PerformanceGoalResource($this->goals->updateProgress($goal, $request->validated(), $request->user())),
            'Progress update ho gaya'
        );
    }

    public function close(GoalProgressRequest $request, PerformanceGoal $goal): JsonResponse
    {
        return ApiResponse::success(
            new PerformanceGoalResource($this->goals->close($goal, $request->validated(), $request->user())),
            'Goal band ho gaya'
        );
    }

    public function destroy(Request $request, PerformanceGoal $goal): JsonResponse
    {
        $this->goals->delete($goal, $request->user());

        return ApiResponse::success(null, 'Goal hata diya gaya');
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\ExitDecisionRequest;
use App\Http\Requests\ExitRequest;
use App\Http\Resources\EmployeeExitResource;
use App\Models\EmployeeExit;
use App\Services\ExitService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeExitController extends ApiController
{
    public function __construct(private readonly ExitService $exits) {}

    public function index(Request $request): JsonResponse
    {
        $exits = $this->scoped($request)->paginate($this->perPage($request));

        return ApiResponse::paginated($exits, EmployeeExitResource::class, 'Exits fetched successfully');
    }

    public function types(): JsonResponse
    {
        $types = [];

        foreach (EmployeeExit::EXIT_TYPES as $value => $label) {
            $types[] = ['value' => $value, 'label' => $label];
        }

        return ApiResponse::success([
            'exit_types' => $types,
            'statuses' => EmployeeExit::STATUSES,
        ], 'Exit types fetched successfully');
    }

    public function pendingApprovals(Request $request): JsonResponse
    {
        $exits = $this->scoped($request)
            ->where('status', EmployeeExit::PENDING)
            ->whereHas('employee', fn (Builder $query) => $query->where('user_id', '!=', $request->user()->id))
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($exits, EmployeeExitResource::class, 'Pending approvals fetched successfully');
    }

    public function pendingHrApproval(Request $request): JsonResponse
    {
        $exits = $this->scoped($request)
            ->where('status', EmployeeExit::MANAGER_APPROVED)
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($exits, EmployeeExitResource::class, 'HR approval queue fetched successfully');
    }

    public function servingNotice(Request $request): JsonResponse
    {
        $exits = $this->scoped($request)
            ->where('status', EmployeeExit::SERVING_NOTICE)
            ->reorder('last_working_date')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($exits, EmployeeExitResource::class, 'Notice period list fetched successfully');
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success($this->exits->summary($request->user()), 'Exit summary fetched successfully');
    }

    public function store(ExitRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new EmployeeExitResource($this->exits->apply($request->user(), $request->validated())),
            'Resignation bhej di gayi — ab manager approve karega'
        );
    }

    public function show(EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeExitResource(
                $exit->load('employee.user', 'manager', 'hr', 'documents.uploader', 'clearances')
            ),
            'Exit details fetched successfully'
        );
    }

    public function managerApprove(ExitDecisionRequest $request, EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeExitResource(
                $this->exits->managerApprove($exit, $request->validated(), $request->user())
            ),
            'Approve ho gaya — ab HR final approval degi'
        );
    }

    public function hrApprove(ExitDecisionRequest $request, EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeExitResource(
                $this->exits->hrApprove($exit, $request->validated(), $request->user())
            ),
            'Final approval ho gaya — notice period shuru'
        );
    }

    public function changeLastWorkingDate(ExitDecisionRequest $request, EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeExitResource(
                $this->exits->changeLastWorkingDate($exit, $request->validated(), $request->user())
            ),
            'Last working date update ho gayi'
        );
    }

    public function reject(ExitDecisionRequest $request, EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeExitResource(
                $this->exits->reject($exit, $request->validated(), $request->user())
            ),
            'Resignation reject kar di gayi'
        );
    }

    public function complete(ExitDecisionRequest $request, EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeExitResource($this->exits->complete($exit, $request->validated(), $request->user())),
            'Exit complete — login band kar diya gaya'
        );
    }

    public function destroy(Request $request, EmployeeExit $exit): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeExitResource($this->exits->withdraw($exit, $request->user())),
            'Resignation wapas le li gayi'
        );
    }

    private function scoped(Request $request): Builder
    {
        return $this->applyFilters(
            EmployeeExit::query()
                ->with(['employee.user', 'manager', 'hr'])
                ->withCount('documents')
                ->visibleTo($request->user()),
            $request,
            ['reason'],
            [
                'status' => 'status',
                'exit_type' => 'exit_type',
                'employee_id' => 'employee_id',
            ]
        )
            ->when($request->filled('from'), fn (Builder $query) => $query->whereDate('resignation_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn (Builder $query) => $query->whereDate('resignation_date', '<=', $request->date('to')))
            ->orderByRaw("FIELD(status, 'pending', 'manager_approved', 'serving_notice', 'exited', 'rejected', 'withdrawn')")
            ->orderByDesc('resignation_date')
            ->orderByDesc('id');
    }
}

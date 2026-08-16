<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\RegularizationDecisionRequest;
use App\Http\Requests\RegularizationRangeRequest;
use App\Http\Requests\RegularizationRequest;
use App\Http\Resources\AttendanceRegularizationResource;
use App\Models\AttendanceRegularization;
use App\Services\RegularizationService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegularizationController extends ApiController
{
    public function __construct(private readonly RegularizationService $regularizations) {}

    public function index(Request $request): JsonResponse
    {
        $records = $this->scoped($request)->paginate($this->perPage($request));

        return ApiResponse::paginated(
            $records,
            AttendanceRegularizationResource::class,
            'Regularization requests fetched successfully'
        );
    }

    public function pendingApprovals(Request $request): JsonResponse
    {
        $records = $this->scoped($request)
            ->where('status', AttendanceRegularization::PENDING)
            ->whereHas('employee', fn (Builder $query) => $query->where('user_id', '!=', $request->user()->id))
            ->paginate($this->perPage($request));

        return ApiResponse::paginated(
            $records,
            AttendanceRegularizationResource::class,
            'Pending approvals fetched successfully'
        );
    }

    public function eligibleDays(RegularizationRangeRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->regularizations->eligibleDays(
                $request->user(),
                $request->employeeId(),
                $request->from(),
                $request->to()
            ),
            'Regularization ke liye eligible din fetch ho gaye'
        );
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->regularizations->summary(
                $request->user(),
                $request->filled('month') ? $request->string('month')->toString() : now()->format('Y-m')
            ),
            'Regularization summary fetched successfully'
        );
    }

    public function store(RegularizationRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new AttendanceRegularizationResource(
                $this->regularizations->apply($request->user(), $request->validated())
            ),
            'Regularization request bhej di gayi'
        );
    }

    public function show(AttendanceRegularization $regularization): JsonResponse
    {
        return ApiResponse::success(
            new AttendanceRegularizationResource(
                $regularization->load('employee.user', 'approver', 'attendance')
            ),
            'Regularization request fetched successfully'
        );
    }

    public function approve(RegularizationDecisionRequest $request, AttendanceRegularization $regularization): JsonResponse
    {
        return ApiResponse::success(
            new AttendanceRegularizationResource(
                $this->regularizations->approve($regularization, $request->validated(), $request->user())
            ),
            'Regularization approve ho gayi — attendance update kar di'
        );
    }

    public function reject(RegularizationDecisionRequest $request, AttendanceRegularization $regularization): JsonResponse
    {
        return ApiResponse::success(
            new AttendanceRegularizationResource(
                $this->regularizations->reject($regularization, $request->validated(), $request->user())
            ),
            'Regularization reject kar di gayi'
        );
    }

    public function destroy(Request $request, AttendanceRegularization $regularization): JsonResponse
    {
        return ApiResponse::success(
            new AttendanceRegularizationResource(
                $this->regularizations->cancel($regularization, $request->user())
            ),
            'Regularization request cancel ho gayi'
        );
    }

    private function scoped(Request $request): Builder
    {
        return $this->applyFilters(
            AttendanceRegularization::query()
                ->with(['employee.user', 'approver'])
                ->visibleTo($request->user()),
            $request,
            ['reason'],
            [
                'status' => 'status',
                'type' => 'type',
                'employee_id' => 'employee_id',
            ]
        )
            ->when($request->filled('from'), fn (Builder $query) => $query->whereDate('attendance_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn (Builder $query) => $query->whereDate('attendance_date', '<=', $request->date('to')))
            ->orderByRaw("FIELD(status, 'pending', 'approved', 'rejected', 'cancelled')")
            ->orderByDesc('attendance_date')
            ->orderByDesc('id');
    }
}

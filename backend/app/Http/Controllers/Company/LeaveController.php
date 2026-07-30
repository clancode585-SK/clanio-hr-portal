<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\LeaveApplyRequest;
use App\Http\Requests\LeaveApproveRequest;
use App\Http\Requests\LeaveCalendarRequest;
use App\Http\Requests\LeaveRejectRequest;
use App\Http\Requests\LeaveYearRequest;
use App\Http\Resources\LeaveRequestResource;
use App\Models\LeaveRequest;
use App\Services\LeaveRequestService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveController extends ApiController
{
    public function __construct(private readonly LeaveRequestService $leaves) {}

    public function index(Request $request): JsonResponse
    {
        $records = TenantCache::remember(
            TenantCache::LEAVES,
            'list:' . $request->user()->id . ':' . $this->cacheKey($request),
            fn () => $this->scoped($request)->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($records, LeaveRequestResource::class, 'Leave requests fetched successfully');
    }

    public function pendingApprovals(Request $request): JsonResponse
    {
        $records = $this->scoped($request)
            ->where('status', LeaveRequest::PENDING)
            ->whereHas('employee', fn ($query) => $query->where('user_id', '!=', $request->user()->id))
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($records, LeaveRequestResource::class, 'Pending approvals fetched successfully');
    }

    public function store(LeaveApplyRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new LeaveRequestResource($this->leaves->apply($request->user(), $request->validated())),
            'Leave applied successfully'
        );
    }

    public function show(LeaveRequest $leave): JsonResponse
    {
        return ApiResponse::success(
            new LeaveRequestResource($leave->load(['leaveType', 'days', 'employee.user', 'approver'])),
            'Leave details fetched successfully'
        );
    }

    public function approve(LeaveApproveRequest $request, LeaveRequest $leave): JsonResponse
    {
        return ApiResponse::success(
            new LeaveRequestResource($this->leaves->approve($leave, $request->validated(), $request->user())),
            'Leave approved successfully'
        );
    }

    public function reject(LeaveRejectRequest $request, LeaveRequest $leave): JsonResponse
    {
        return ApiResponse::success(
            new LeaveRequestResource($this->leaves->reject($leave, $request->validated(), $request->user())),
            'Leave rejected successfully'
        );
    }

    public function destroy(Request $request, LeaveRequest $leave): JsonResponse
    {
        return ApiResponse::success(
            new LeaveRequestResource($this->leaves->cancel($leave, $request->user())),
            'Leave cancelled successfully'
        );
    }

    public function myBalance(LeaveYearRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->leaves->myBalances($request->user(), $request->year()),
            'Leave balance fetched successfully'
        );
    }

    public function calendar(LeaveCalendarRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->leaves->calendar($request->user(), $request->validated('month') ?? now()->format('Y-m')),
            'Leave calendar fetched successfully'
        );
    }

    private function scoped(Request $request)
    {
        return $this->applyFilters(
            LeaveRequest::query()
                ->with(['leaveType', 'employee.user', 'approver'])
                ->visibleTo($request->user()),
            $request,
            ['reason'],
            [
                'status' => 'status',
                'leave_type_id' => 'leave_type_id',
                'employee_id' => 'employee_id',
            ]
        )
            ->when($request->filled('from'), fn ($query) => $query->whereDate('to_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('from_date', '<=', $request->date('to')))
            ->orderByDesc('from_date')
            ->orderByDesc('id');
    }
}

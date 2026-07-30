<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\LeaveBalanceAdjustRequest;
use App\Http\Requests\LeaveEncashRequest;
use App\Http\Requests\LeaveYearRequest;
use App\Http\Resources\LeaveBalanceResource;
use App\Models\LeaveBalance;
use App\Services\LeaveBalanceService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveBalanceController extends ApiController
{
    public function __construct(private readonly LeaveBalanceService $balances) {}

    public function index(Request $request): JsonResponse
    {
        $balances = TenantCache::remember(
            TenantCache::LEAVE_BALANCES,
            'list:' . $request->user()->id . ':' . $this->cacheKey($request),
            fn () => $this->applyFilters(
                LeaveBalance::query()
                    ->with(['leaveType', 'employee.user'])
                    ->visibleTo($request->user()),
                $request,
                [],
                [
                    'employee_id' => 'employee_id',
                    'leave_type_id' => 'leave_type_id',
                    'year' => 'year',
                ]
            )->orderByDesc('year')->orderBy('employee_id')->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($balances, LeaveBalanceResource::class, 'Leave balances fetched successfully');
    }

    public function allocate(LeaveYearRequest $request): JsonResponse
    {
        $companyId = $this->tenantId();

        if ($companyId === null) {
            throw new ApiException(
                'Balance allocate karne ke liye company chunni padegi. X-Company-Id header bhejo.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return ApiResponse::success(
            $this->balances->allocate($companyId, $request->year(), $request->user()),
            'Leave balances allocated successfully'
        );
    }

    public function accrue(LeaveYearRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->balances->accrue($request->year(), $request->user()),
            'Monthly accrual credited successfully'
        );
    }

    public function carryForward(LeaveYearRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->balances->carryForward($request->year(), $request->user()),
            'Carry forward completed successfully'
        );
    }

    public function adjust(LeaveBalanceAdjustRequest $request, LeaveBalance $leaveBalance): JsonResponse
    {
        return ApiResponse::success(
            new LeaveBalanceResource($this->balances->adjust(
                $leaveBalance,
                (float) $request->validated('days'),
                $request->validated('remarks'),
                $request->user()
            )),
            'Leave balance adjusted successfully'
        );
    }

    public function encash(LeaveEncashRequest $request, LeaveBalance $leaveBalance): JsonResponse
    {
        $result = $this->balances->encash($leaveBalance, (float) $request->validated('days'), $request->user());

        return ApiResponse::success([
            'balance' => new LeaveBalanceResource($result['balance']),
            'encashed_now' => $result['encashed_now'],
            'encashed_total' => $result['encashed_total'],
            'note' => $result['note'],
        ], 'Leave encashment recorded successfully');
    }
}

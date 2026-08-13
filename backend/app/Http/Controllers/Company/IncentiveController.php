<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\IncentiveRuleRequest;
use App\Http\Requests\RecognitionRequest;
use App\Http\Resources\IncentiveRecordResource;
use App\Http\Resources\IncentiveRuleResource;
use App\Models\Employee;
use App\Models\IncentiveRecord;
use App\Models\IncentiveRule;
use App\Models\PerformanceGoal;
use App\Services\IncentiveService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncentiveController extends ApiController
{
    public function __construct(private readonly IncentiveService $incentives) {}

    /* ----------------------------------------------------------------- rules */

    public function rules(Request $request): JsonResponse
    {
        return ApiResponse::success(
            IncentiveRuleResource::collection($this->incentives->rules($request->user())),
            'Incentive rules fetched successfully'
        );
    }

    public function storeRule(IncentiveRuleRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new IncentiveRuleResource(
                $this->incentives->createRule($request->validated(), $request->user(), $this->tenantId())
            ),
            'Incentive rule ban gaya'
        );
    }

    public function showRule(IncentiveRule $rule): JsonResponse
    {
        return ApiResponse::success(
            new IncentiveRuleResource($rule->load('slabs', 'role')),
            'Incentive rule fetched successfully'
        );
    }

    public function updateRule(IncentiveRuleRequest $request, IncentiveRule $rule): JsonResponse
    {
        return ApiResponse::success(
            new IncentiveRuleResource($this->incentives->updateRule($rule, $request->validated(), $request->user())),
            'Incentive rule update ho gaya'
        );
    }

    public function destroyRule(Request $request, IncentiveRule $rule): JsonResponse
    {
        $this->incentives->deleteRule($rule, $request->user());

        return ApiResponse::success(null, 'Incentive rule hata diya gaya');
    }

    /* --------------------------------------------------------------- records */

    public function index(Request $request): JsonResponse
    {
        $records = $this->applyFilters(
            IncentiveRecord::query()
                ->with('employee.user', 'rule', 'approver')
                ->visibleTo($request->user()),
            $request,
            [],
            [
                'status' => 'status',
                'period_type' => 'period_type',
                'period_label' => 'period_label',
                'employee_id' => 'employee_id',
            ]
        )
            ->orderByDesc('period_start')
            ->orderByDesc('incentive_percent')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($records, IncentiveRecordResource::class, 'Incentives fetched successfully');
    }

    public function calculate(Request $request): JsonResponse
    {
        $periodType = $request->string('period_type', PerformanceGoal::PERIOD_MONTH)->toString();
        $periodLabel = $request->string('period_label')->toString();

        if ($periodLabel === '') {
            return ApiResponse::error('Period label do — jaise 2026-08.', 422, 'PERIOD_REQUIRED');
        }

        if ($request->filled('employee_id')) {
            $employee = Employee::query()
                ->visibleTo($request->user())
                ->whereKey((int) $request->input('employee_id'))
                ->firstOrFail();

            return ApiResponse::success(
                new IncentiveRecordResource(
                    $this->incentives->calculate($employee, $periodType, $periodLabel, $request->user())
                ),
                'Incentive calculate ho gaya'
            );
        }

        $count = $this->incentives->calculateCompany(
            (int) $request->user()->company_id,
            $periodType,
            $periodLabel,
            $request->user()
        );

        return ApiResponse::success(
            ['period_label' => $periodLabel, 'calculated' => $count],
            $count . ' employee ka incentive calculate ho gaya'
        );
    }

    public function show(IncentiveRecord $incentive): JsonResponse
    {
        return ApiResponse::success(
            new IncentiveRecordResource($incentive->load('employee.user', 'rule', 'approver')),
            'Incentive fetched successfully'
        );
    }

    public function approve(RecognitionRequest $request, IncentiveRecord $incentive): JsonResponse
    {
        return ApiResponse::success(
            new IncentiveRecordResource($this->incentives->approve($incentive, $request->validated(), $request->user())),
            'Incentive approve ho gaya'
        );
    }

    public function reject(RecognitionRequest $request, IncentiveRecord $incentive): JsonResponse
    {
        return ApiResponse::success(
            new IncentiveRecordResource($this->incentives->reject($incentive, $request->validated(), $request->user())),
            'Incentive reject kar diya gaya'
        );
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->incentives->summary(
                $request->user(),
                $request->string('period_type', PerformanceGoal::PERIOD_MONTH)->toString(),
                $request->string('period_label')->toString()
            ),
            'Incentive summary fetched successfully'
        );
    }
}

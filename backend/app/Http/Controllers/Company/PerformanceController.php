<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\PerformanceWeightRequest;
use App\Services\PerformanceService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PerformanceController extends ApiController
{
    public function __construct(private readonly PerformanceService $performance) {}

    public function score(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->performance->scoreFor(
                $request->user(),
                $request->filled('employee_id') ? (int) $request->input('employee_id') : null,
                $this->month($request)
            ),
            'Performance score fetched successfully'
        );
    }

    public function trend(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->performance->trend(
                $request->user(),
                $request->filled('employee_id') ? (int) $request->input('employee_id') : null,
                $request->integer('months', 6)
            ),
            'Performance trend fetched successfully'
        );
    }

    public function leaderboard(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->performance->leaderboard($request->user(), $this->month($request)),
            'Performance leaderboard fetched successfully'
        );
    }

    public function weights(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->performance->weights($request->user()),
            'Performance weights fetched successfully'
        );
    }

    public function updateWeights(PerformanceWeightRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->performance->updateWeights($request->user(), $request->validated()),
            'Performance weights update ho gaye'
        );
    }

    public function freeze(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->performance->freeze($request->user(), $this->month($request)),
            'Month freeze ho gaya — ab ye score nahi badlega'
        );
    }

    private function month(Request $request): string
    {
        return $request->filled('month')
            ? $request->string('month')->toString()
            : now()->format('Y-m');
    }
}

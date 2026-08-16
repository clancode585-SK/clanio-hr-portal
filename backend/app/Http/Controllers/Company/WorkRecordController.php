<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\WorkRecordRequest;
use App\Services\WorkRecordService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class WorkRecordController extends ApiController
{
    public function __construct(private readonly WorkRecordService $records) {}

    public function show(WorkRecordRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->records->forEmployee($request->user(), $request->employeeId(), $request->month()),
            'Work record fetched successfully'
        );
    }

    public function team(WorkRecordRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->records->forTeam($request->user(), $request->month()),
            'Team work record fetched successfully'
        );
    }
}

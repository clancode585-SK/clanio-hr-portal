<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\WorkShiftRequest;
use App\Http\Resources\WorkShiftResource;
use App\Models\WorkShift;
use App\Services\WorkShiftService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkShiftController extends ApiController
{
    public function __construct(private readonly WorkShiftService $shifts) {}

    public function index(Request $request): JsonResponse
    {
        $shifts = TenantCache::remember(
            TenantCache::WORK_SHIFTS,
            'list:' . $this->cacheKey($request),
            fn () => $this->applyFilters(
                WorkShift::query()->withCount('employees'),
                $request,
                ['name', 'code'],
                ['status' => 'status']
            )->orderByDesc('is_default')->orderBy('name')->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($shifts, WorkShiftResource::class, 'Work shifts fetched successfully');
    }

    public function store(WorkShiftRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new WorkShiftResource($this->shifts->create($request->validated(), $request->user(), $this->tenantId())),
            'Work shift created successfully'
        );
    }

    public function show(WorkShift $workShift): JsonResponse
    {
        return ApiResponse::success(
            new WorkShiftResource($workShift->loadCount('employees')),
            'Work shift details fetched successfully'
        );
    }

    public function update(WorkShiftRequest $request, WorkShift $workShift): JsonResponse
    {
        return ApiResponse::success(
            new WorkShiftResource($this->shifts->update($workShift, $request->validated(), $request->user())),
            'Work shift updated successfully'
        );
    }

    public function destroy(WorkShift $workShift): JsonResponse
    {
        $this->shifts->delete($workShift);

        return ApiResponse::success(null, 'Work shift deleted successfully');
    }
}

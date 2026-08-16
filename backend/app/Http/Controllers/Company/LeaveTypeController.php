<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\LeaveTypeRequest;
use App\Http\Resources\LeaveTypeResource;
use App\Models\LeaveType;
use App\Services\LeaveTypeService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveTypeController extends ApiController
{
    public function __construct(private readonly LeaveTypeService $types) {}

    public function index(Request $request): JsonResponse
    {
        $types = TenantCache::remember(
            TenantCache::LEAVE_TYPES,
            'list:' . $this->cacheKey($request),
            fn () => $this->applyFilters(
                LeaveType::query(),
                $request,
                ['name', 'code'],
                ['status' => 'status', 'applicable_to' => 'applicable_to']
            )->orderBy('sort_order')->orderBy('name')->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($types, LeaveTypeResource::class, 'Leave types fetched successfully');
    }

    public function store(LeaveTypeRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new LeaveTypeResource($this->types->create($request->validated(), $request->user(), $this->tenantId())),
            'Leave type created successfully'
        );
    }

    public function show(LeaveType $leaveType): JsonResponse
    {
        return ApiResponse::success(
            new LeaveTypeResource($leaveType),
            'Leave type details fetched successfully'
        );
    }

    public function update(LeaveTypeRequest $request, LeaveType $leaveType): JsonResponse
    {
        return ApiResponse::success(
            new LeaveTypeResource($this->types->update($leaveType, $request->validated(), $request->user())),
            'Leave type updated successfully'
        );
    }

    public function destroy(LeaveType $leaveType): JsonResponse
    {
        $this->types->delete($leaveType);

        return ApiResponse::success(null, 'Leave type deleted successfully');
    }
}

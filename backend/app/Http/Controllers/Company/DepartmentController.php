<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\DepartmentRequest;
use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use App\Services\DepartmentService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends ApiController
{
    public function __construct(private readonly DepartmentService $departments) {}

    public function index(Request $request): JsonResponse
    {
        $departments = TenantCache::remember(
            TenantCache::DEPARTMENTS,
            $this->cacheKey($request),
            fn () => $this->applyFilters(
                Department::query()->withCount(['teams', 'users']),
                $request,
                ['name', 'code'],
                ['status' => 'status', 'branch_id' => 'branch_id']
            )->orderBy('name')->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($departments, DepartmentResource::class, 'Departments fetched successfully');
    }

    public function store(DepartmentRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new DepartmentResource($this->departments->create($request->validated(), $request->user(), $this->tenantId())),
            'Department created successfully'
        );
    }

    public function show(Department $department): JsonResponse
    {
        return ApiResponse::success(
            new DepartmentResource($department->load('teams')->loadCount(['teams', 'users'])),
            'Department details fetched successfully'
        );
    }

    public function update(DepartmentRequest $request, Department $department): JsonResponse
    {
        return ApiResponse::success(
            new DepartmentResource($this->departments->update($department, $request->validated(), $request->user())),
            'Department updated successfully'
        );
    }

    public function destroy(Department $department): JsonResponse
    {
        $this->departments->delete($department);

        return ApiResponse::success(null, 'Department deleted successfully');
    }
}

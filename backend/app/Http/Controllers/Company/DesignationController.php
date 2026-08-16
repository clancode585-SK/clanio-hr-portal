<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\DesignationRequest;
use App\Http\Resources\DesignationResource;
use App\Models\Designation;
use App\Services\DesignationService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DesignationController extends ApiController
{
    public function __construct(private readonly DesignationService $designations) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Designation::query()
            ->withoutGlobalScope(\App\Support\Scopes\CompanyScope::class)
            ->with('department')
            ->withCount('employees');

        if ($user && ! $user->isSuperAdmin() && $user->company_id !== null) {
            $query->where('company_id', $user->company_id);
        }

        $designations = $this->applyFilters(
            $query,
            $request,
            ['name', 'code'],
            ['status' => 'status', 'department_id' => 'department_id']
        )->orderBy('name')->paginate($this->perPage($request));

        return ApiResponse::paginated($designations, DesignationResource::class, 'Designations fetched successfully');
    }

    public function store(DesignationRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new DesignationResource($this->designations->create($request->validated(), $request->user(), $this->tenantId())),
            'Designation created successfully'
        );
    }

    public function show(Designation $designation): JsonResponse
    {
        return ApiResponse::success(
            new DesignationResource($designation->load('department')->loadCount('employees')),
            'Designation details fetched successfully'
        );
    }

    public function update(DesignationRequest $request, Designation $designation): JsonResponse
    {
        return ApiResponse::success(
            new DesignationResource($this->designations->update($designation, $request->validated(), $request->user())),
            'Designation updated successfully'
        );
    }

    public function destroy(Designation $designation): JsonResponse
    {
        $this->designations->delete($designation);

        return ApiResponse::success(null, 'Designation deleted successfully');
    }
}

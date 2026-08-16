<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\RoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Services\RoleService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends ApiController
{
    public function __construct(private readonly RoleService $roles) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Role::query();

        if ($user?->isSuperAdmin() && app(\App\Support\TenantContext::class)->id() === null) {
            $query = Role::withoutGlobalScopes();
        }

        $roles = TenantCache::remember(
            TenantCache::ROLES,
            $this->cacheKey($request) . ($user?->isSuperAdmin() ? '_super' : ''),
            fn () => $this->applyFilters(
                $query->with('permissions')->withCount('users'),
                $request,
                ['name', 'slug'],
                ['is_active' => 'is_active']
            )->orderBy('hierarchy_level')->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($roles, RoleResource::class, 'Roles fetched successfully');
    }

    public function store(RoleRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new RoleResource($this->roles->create($request->validated(), $request->user(), $this->tenantId())),
            'Role created successfully'
        );
    }

    public function show(Role $role): JsonResponse
    {
        return ApiResponse::success(
            new RoleResource($role->load('permissions')->loadCount('users')),
            'Role details fetched successfully'
        );
    }

    public function update(RoleRequest $request, Role $role): JsonResponse
    {
        return ApiResponse::success(
            new RoleResource($this->roles->update($role, $request->validated(), $request->user())),
            'Role updated successfully'
        );
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        $this->roles->delete($role, $request->user());

        return ApiResponse::success(null, 'Role deleted successfully');
    }
}

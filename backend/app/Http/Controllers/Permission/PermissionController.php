<?php

declare(strict_types=1);

namespace App\Http\Controllers\Permission;

use App\Http\Controllers\ApiController;
use App\Http\Resources\PermissionResource;
use App\Models\Permission;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;

class PermissionController extends ApiController
{
    public function index(): JsonResponse
    {
        $permissions = TenantCache::remember(
            TenantCache::PERMISSIONS,
            'catalogue',
            fn () => Permission::query()->orderBy('group_name')->orderBy('id')->get()->groupBy('module')
        );

        return ApiResponse::success(
            $permissions->map(fn ($group) => PermissionResource::collection($group)),
            'Permissions fetched successfully'
        );
    }
}

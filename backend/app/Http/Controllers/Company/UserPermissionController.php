<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\UserPermissionRequest;
use App\Models\Company;
use App\Models\Department;
use App\Models\User;
use App\Services\UserPermissionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserPermissionController extends ApiController
{
    public function __construct(private readonly UserPermissionService $permissions) {}

    public function tree(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->permissions->tree($request->user()),
            'Permission tree fetched successfully'
        );
    }

    public function show(Request $request, User $user): JsonResponse
    {
        return ApiResponse::success(
            $this->permissions->forUser($user, $request->user()),
            'User permissions fetched successfully'
        );
    }

    public function update(UserPermissionRequest $request, User $user): JsonResponse
    {
        return ApiResponse::success(
            $this->permissions->sync($user, $request->validated()['permissions'], $request->user()),
            'Permissions update ho gayi'
        );
    }

    public function reset(Request $request, User $user): JsonResponse
    {
        return ApiResponse::success(
            $this->permissions->reset($user, $request->user()),
            'Permissions wapas role wali default par aa gayi'
        );
    }

    public function department(Request $request, Department $department): JsonResponse
    {
        return ApiResponse::success(
            $this->permissions->forDepartment($department, $request->user()),
            'Department permissions fetched successfully'
        );
    }

    public function setDepartment(UserPermissionRequest $request, Department $department): JsonResponse
    {
        return ApiResponse::success(
            $this->permissions->syncDepartment($department, $request->validated()['permissions'], $request->user()),
            'Department ki default permissions set ho gayi'
        );
    }

    public function modules(Request $request, Company $company): JsonResponse
    {
        return ApiResponse::success(
            $this->permissions->modules($company, $request->user()),
            'Company modules fetched successfully'
        );
    }

    public function setModules(UserPermissionRequest $request, Company $company): JsonResponse
    {
        return ApiResponse::success(
            $this->permissions->setModules($company, $request->validated()['modules'], $request->user()),
            'Company modules update ho gaye'
        );
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends ApiController
{
    public function __construct(private readonly UserService $users) {}

    public function index(Request $request): JsonResponse
    {
        $users = TenantCache::remember(
            TenantCache::USERS,
            'actor:' . $request->user()->id . ':' . $this->cacheKey($request),
            fn () => $this->applyFilters(
                User::query()->with('roles')->visibleTo($request->user()),
                $request,
                ['name', 'email', 'phone'],
                ['status' => 'status', 'branch_id' => 'branch_id', 'department_id' => 'department_id', 'team_id' => 'team_id']
            )
                ->when($request->filled('role_id'), fn (Builder $query) => $query->whereHas(
                    'roles',
                    fn (Builder $inner) => $inner->where('roles.id', $request->integer('role_id'))
                ))
                ->latest('id')
                ->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($users, UserResource::class, 'Users fetched successfully');
    }

    public function store(UserRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new UserResource($this->users->create($request->validated(), $request->user(), $this->tenantId())),
            'User created successfully'
        );
    }

    public function show(User $user): JsonResponse
    {
        return ApiResponse::success(
            new UserResource($user->load('roles.permissions', 'department', 'team')),
            'User details fetched successfully'
        );
    }

    public function update(UserRequest $request, User $user): JsonResponse
    {
        return ApiResponse::success(
            new UserResource($this->users->update($user, $request->validated(), $request->user())),
            'User updated successfully'
        );
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->users->delete($user, $request->user());

        return ApiResponse::success(null, 'User deleted successfully');
    }
}

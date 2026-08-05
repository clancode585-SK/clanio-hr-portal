<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final class UserService
{
    public function create(array $data, User $actor, ?int $companyId): User
    {
        $this->assertUserLimit($companyId);
        $data = $this->resolvePlacement($data);
        $roleIds = $this->resolveRoles($data['role_ids'], $companyId, $actor);

        return DB::transaction(function () use ($data, $actor, $companyId, $roleIds): User {
            $user = new User(Arr::except($data, ['role_ids']));
            $user->company_id = $companyId;
            $user->created_by = $actor->id;
            $user->save();

            $this->syncRoles($user, $roleIds, $actor, $companyId);

            if ($companyId !== null) {
                Company::query()->whereKey($companyId)->increment('employee_count');
            }

            return $user->load('roles');
        });
    }

    public function update(User $user, array $data, User $actor): User
    {
        $this->assertManageable($user, $actor);

        $data = $this->resolvePlacement($data);

        $roleIds = isset($data['role_ids'])
            ? $this->resolveRoles($data['role_ids'], $user->company_id, $actor)
            : null;

        return DB::transaction(function () use ($user, $data, $actor, $roleIds): User {
            $user->fill(Arr::except($data, ['role_ids']));
            $user->updated_by = $actor->id;
            $user->save();

            if ($roleIds !== null) {
                $this->syncRoles($user, $roleIds, $actor, $user->company_id);
            }

            if (isset($data['password']) || isset($data['status'])) {
                $user->revokeTokens();
            }

            TenantCache::flush(TenantCache::USERS, TenantCache::PERMISSIONS);

            return $user->refresh()->load('roles');
        });
    }

    public function delete(User $user, User $actor): void
    {
        $this->assertManageable($user, $actor);

        if ($user->id === $actor->id) {
            throw new ApiException('You cannot delete your own account.', 409, 'SELF_DELETE_FORBIDDEN');
        }

        DB::transaction(function () use ($user): void {
            $user->revokeTokens();
            $user->roles()->detach();
            $user->deactivate();

            if ($user->company_id !== null) {
                Company::query()->whereKey($user->company_id)->where('employee_count', '>', 0)->decrement('employee_count');
            }

            TenantCache::flush(TenantCache::USERS, TenantCache::PERMISSIONS);
        });
    }

    private function resolvePlacement(array $data): array
    {
        if (! array_key_exists('team_id', $data) || $data['team_id'] === null) {
            return $data;
        }

        $departmentId = Team::query()->whereKey($data['team_id'])->value('department_id');

        if ($departmentId === null) {
            throw new ApiException('This team does not belong to your company.', 422, 'TEAM_INVALID');
        }

        if (isset($data['department_id']) && (int) $data['department_id'] !== (int) $departmentId) {
            throw new ApiException(
                'This team does not belong to the department you selected.',
                422,
                'PLACEMENT_MISMATCH'
            );
        }

        $data['department_id'] = (int) $departmentId;

        return $data;
    }

    private function resolveRoles(array $roleIds, ?int $companyId, User $actor): array
    {
        $roles = Role::query()
            ->withoutGlobalScopes()
            ->whereIn('id', $roleIds)
            ->when($companyId === null, fn ($query) => $query->whereNull('company_id'))
            ->when($companyId !== null, fn ($query) => $query->where('company_id', $companyId))
            ->where('is_active', 1)
            ->get();

        if ($roles->count() !== count(array_unique($roleIds))) {
            throw new ApiException('One or more roles do not belong to this company.', 422, 'ROLE_INVALID');
        }

        if (! $actor->isSuperAdmin()) {
            $elevated = $roles->where('hierarchy_level', '<', $actor->lowestRoleLevel());

            if ($elevated->isNotEmpty()) {
                throw new ApiException(
                    'You cannot assign a role higher than your own: ' . $elevated->pluck('slug')->implode(', '),
                    403,
                    'ROLE_ESCALATION'
                );
            }
        }

        return $roles->pluck('id')->all();
    }

    private function syncRoles(User $user, array $roleIds, User $actor, ?int $companyId): void
    {
        $pivot = array_fill_keys($roleIds, [
            'company_id' => $companyId,
            'assigned_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user->roles()->sync($pivot);

        TenantCache::flush(TenantCache::USERS, TenantCache::PERMISSIONS);
    }

    private function assertUserLimit(?int $companyId): void
    {
        if ($companyId === null) {
            return;
        }

        $company = Company::query()->findOrFail($companyId);

        if ($company->max_employees !== null && $company->employee_count >= $company->max_employees) {
            throw new ApiException(
                'This company has reached its user limit of ' . $company->max_employees . '.',
                402,
                'PLAN_LIMIT_USERS'
            );
        }
    }

    private function assertManageable(User $user, User $actor): void
    {
        if ($user->isSuperAdmin() && ! $actor->isSuperAdmin()) {
            throw new ApiException('This account cannot be managed.', 403, 'FORBIDDEN_TARGET');
        }
    }
}

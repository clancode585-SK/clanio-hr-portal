<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final class RoleService
{
    public function create(array $data, User $actor, ?int $companyId): Role
    {
        $this->assertGrantable($actor, $data['permissions']);

        return DB::transaction(function () use ($data, $actor, $companyId): Role {
            $targetCompanyId = $companyId ?? $actor->company_id ?? 1;
            $role = new Role(Arr::except($data, ['permissions']));
            $role->company_id = $targetCompanyId;
            $role->created_by = $actor->id;
            $role->save();

            $role->permissions()->sync($this->permissionIds($data['permissions']));

            TenantCache::flush(TenantCache::ROLES, TenantCache::PERMISSIONS);

            return $role->load('permissions');
        });
    }

    public function update(Role $role, array $data, User $actor): Role
    {
        $this->assertMutable($role, $actor);

        if (isset($data['permissions'])) {
            $this->assertGrantable($actor, $data['permissions']);
        }

        return DB::transaction(function () use ($role, $data, $actor): Role {
            $role->fill(Arr::except($data, ['permissions']));
            $role->updated_by = $actor->id;
            $role->save();

            if (isset($data['permissions'])) {
                $role->permissions()->sync($this->permissionIds($data['permissions']));
            }

            TenantCache::flush(TenantCache::ROLES, TenantCache::PERMISSIONS, TenantCache::USERS);

            return $role->refresh()->load('permissions');
        });
    }

    public function delete(Role $role, User $actor): void
    {
        $this->assertMutable($role, $actor);

        if ($role->users()->exists()) {
            throw new ApiException('This role is assigned to users. Reassign them first.', 409, 'ROLE_IN_USE');
        }

        DB::transaction(function () use ($role): void {
            $role->permissions()->detach();
            $role->delete();

            TenantCache::flush(TenantCache::ROLES, TenantCache::PERMISSIONS);
        });
    }

    private function assertMutable(Role $role, User $actor): void
    {
        if ($role->is_system && ! $actor->isSuperAdmin()) {
            throw new ApiException('System roles cannot be modified.', 403, 'ROLE_IMMUTABLE');
        }
    }

    private function assertGrantable(User $actor, array $permissions): void
    {
        if ($actor->isSuperAdmin()) {
            return;
        }

        $extra = array_values(array_diff($permissions, $actor->permissionSlugs()));

        if ($extra !== []) {
            throw new ApiException(
                'You cannot grant permissions you do not hold: ' . implode(', ', $extra),
                403,
                'PERMISSION_ESCALATION'
            );
        }
    }

    private function permissionIds(array $slugs): array
    {
        return Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();
    }
}

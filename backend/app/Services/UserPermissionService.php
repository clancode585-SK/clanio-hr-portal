<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Department;
use App\Models\Permission;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class UserPermissionService
{
    public const GRANT = 'grant';

    public const REVOKE = 'revoke';

    public const MANAGE_PERMISSION = 'user.permission';

    public function tree(User $actor): array
    {
        $disabled = $this->disabledModules($actor->company_id);
        $mine = $actor->permissionSlugs();
        $isSuper = $actor->isSuperAdmin();

        $modules = [];

        foreach (Permission::query()->orderBy('module')->orderBy('slug')->get() as $permission) {
            $modules[$permission->module][] = [
                'id' => (int) $permission->id,
                'slug' => $permission->slug,
                'name' => $permission->name,
                'action' => $permission->action,
                'can_assign' => $isSuper || in_array($permission->slug, $mine, true),
            ];
        }

        $out = [];

        foreach ($modules as $module => $permissions) {
            $out[] = [
                'module' => $module,
                'is_enabled' => ! in_array($module, $disabled, true),
                'permissions' => $permissions,
            ];
        }

        return ['modules' => $out, 'total' => Permission::query()->count()];
    }

    public function forDepartment(Department $department, User $actor): array
    {
        $this->assertCanManage($actor);

        $slugs = $this->departmentSlugs((int) $department->id);

        return [
            'department_id' => (int) $department->id,
            'department_name' => $department->name,
            'permissions' => $slugs,
            'employees' => DB::table('users')
                ->where('department_id', $department->id)
                ->where('is_active', 1)
                ->count(),
        ];
    }

    public function syncDepartment(Department $department, array $slugs, User $actor): array
    {
        $this->assertCanManage($actor);
        $this->assertAssignable($slugs, $actor);

        DB::transaction(function () use ($department, $slugs, $actor): void {
            DB::table('department_permissions')->where('department_id', $department->id)->delete();

            $ids = Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();
            $now = Carbon::now();
            $rows = [];

            foreach ($ids as $id) {
                $rows[] = [
                    'company_id' => $department->company_id,
                    'department_id' => $department->id,
                    'permission_id' => $id,
                    'assigned_by' => $actor->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            if ($rows !== []) {
                DB::table('department_permissions')->insert($rows);
            }

            $this->flush();
        });

        return $this->forDepartment($department, $actor);
    }

    public function forUser(User $target, User $actor): array
    {
        $this->assertManageable($target, $actor);

        $fromRoles = $this->roleSlugs($target);
        $fromDepartment = $this->departmentSlugs($target->department_id);
        $overrides = $this->overrides($target);

        $granted = array_keys(array_filter($overrides, static fn (string $e): bool => $e === self::GRANT));
        $revoked = array_keys(array_filter($overrides, static fn (string $e): bool => $e === self::REVOKE));

        $effective = $target->permissionSlugs();

        return [
            'user_id' => (int) $target->id,
            'name' => $target->name,
            'email' => $target->email,
            'roles' => $target->roles->map(fn ($role): array => [
                'id' => (int) $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
            ])->all(),
            'from_roles' => array_values($fromRoles),
            'from_department' => array_values($fromDepartment),
            'granted' => array_values($granted),
            'revoked' => array_values($revoked),
            'effective' => array_values($effective),
            'counts' => [
                'from_roles' => count($fromRoles),
                'from_department' => count($fromDepartment),
                'granted' => count($granted),
                'revoked' => count($revoked),
                'effective' => count($effective),
            ],
        ];
    }

    /**
     * Frontend poori effective list bhejta hai — service khud nikalti hai ki
     * role se kya mil raha hai aur kya grant/revoke karna padega.
     */
    public function sync(User $target, array $slugs, User $actor): array
    {
        $this->assertManageable($target, $actor);
        $this->assertAssignable($slugs, $actor);

        $wanted = array_values(array_unique($slugs));
        $default = array_unique(array_merge(
            $this->roleSlugs($target),
            $this->departmentSlugs($target->department_id)
        ));

        $grants = array_diff($wanted, $default);
        $revokes = array_diff($default, $wanted);

        $this->assertNotLockingSelf($target, $actor, $revokes);

        DB::transaction(function () use ($target, $grants, $revokes, $actor): void {
            DB::table('user_permissions')->where('user_id', $target->id)->delete();

            $ids = Permission::query()
                ->whereIn('slug', array_merge($grants, $revokes))
                ->pluck('id', 'slug')
                ->all();

            $rows = [];
            $now = Carbon::now();

            foreach ($grants as $slug) {
                $rows[] = $this->row($target, (int) $ids[$slug], self::GRANT, $actor, $now);
            }

            foreach ($revokes as $slug) {
                $rows[] = $this->row($target, (int) $ids[$slug], self::REVOKE, $actor, $now);
            }

            if ($rows !== []) {
                DB::table('user_permissions')->insert($rows);
            }

            $this->flush();
        });

        return $this->forUser($target->refresh(), $actor);
    }

    public function reset(User $target, User $actor): array
    {
        $this->assertManageable($target, $actor);

        DB::table('user_permissions')->where('user_id', $target->id)->delete();
        $this->flush();

        return $this->forUser($target->refresh(), $actor);
    }

    /* ------------------------------------------------------- company modules */

    public function modules(Company $company, User $actor): array
    {
        $this->assertSuperAdmin($actor, 'company module dekhne');

        $rows = DB::table('company_modules')
            ->where('company_id', $company->id)
            ->orderBy('module')
            ->get(['module', 'is_enabled', 'note']);

        $counts = DB::table('permissions')
            ->groupBy('module')
            ->pluck(DB::raw('COUNT(*)'), 'module')
            ->all();

        return [
            'company_id' => (int) $company->id,
            'company_name' => $company->name,
            'modules' => $rows->map(fn ($row): array => [
                'module' => $row->module,
                'is_enabled' => (bool) $row->is_enabled,
                'permissions' => (int) ($counts[$row->module] ?? 0),
                'note' => $row->note,
            ])->all(),
        ];
    }

    public function setModules(Company $company, array $modules, User $actor): array
    {
        $this->assertSuperAdmin($actor, 'company module badalne');

        $known = DB::table('permissions')->distinct()->pluck('module')->all();

        DB::transaction(function () use ($company, $modules, $known, $actor): void {
            foreach ($modules as $module => $enabled) {
                if (! in_array($module, $known, true)) {
                    throw new ApiException('Module nahi mila: ' . $module, 422, 'MODULE_INVALID');
                }

                DB::table('company_modules')->updateOrInsert(
                    ['company_id' => $company->id, 'module' => $module],
                    [
                        'is_enabled' => $enabled ? 1 : 0,
                        'updated_by' => $actor->id,
                        'updated_at' => Carbon::now(),
                        'created_at' => Carbon::now(),
                    ]
                );
            }

            $this->flushAll();
        });

        return $this->modules($company, $actor);
    }

    /* --------------------------------------------------------------- guards */

    private function roleSlugs(User $target): array
    {
        return DB::table('permissions')
            ->join('role_permissions', 'role_permissions.permission_id', '=', 'permissions.id')
            ->join('roles', 'roles.id', '=', 'role_permissions.role_id')
            ->join('user_roles', 'user_roles.role_id', '=', 'roles.id')
            ->where('user_roles.user_id', $target->id)
            ->where('roles.is_active', 1)
            ->distinct()
            ->pluck('permissions.slug')
            ->all();
    }

    private function departmentSlugs(?int $departmentId): array
    {
        if ($departmentId === null) {
            return [];
        }

        return DB::table('permissions')
            ->join('department_permissions as dp', 'dp.permission_id', '=', 'permissions.id')
            ->where('dp.department_id', $departmentId)
            ->distinct()
            ->pluck('permissions.slug')
            ->all();
    }

    private function assertCanManage(User $actor): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission(self::MANAGE_PERMISSION)) {
            return;
        }

        throw new ApiException('Aapke paas permission dene ka haq nahi hai.', 403, 'FORBIDDEN');
    }

    /** @return array<string, string> slug => effect */
    private function overrides(User $target): array
    {
        return DB::table('user_permissions as up')
            ->join('permissions as p', 'p.id', '=', 'up.permission_id')
            ->where('up.user_id', $target->id)
            ->pluck('up.effect', 'p.slug')
            ->all();
    }

    private function row(User $target, int $permissionId, string $effect, User $actor, Carbon $now): array
    {
        return [
            'company_id' => $target->company_id,
            'user_id' => $target->id,
            'permission_id' => $permissionId,
            'effect' => $effect,
            'assigned_by' => $actor->id,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    private function assertManageable(User $target, User $actor): void
    {
        if (! $actor->isSuperAdmin() && ! $actor->hasPermission(self::MANAGE_PERMISSION)) {
            throw new ApiException('Aapke paas permission dene ka haq nahi hai.', 403, 'FORBIDDEN');
        }

        if ($target->isSuperAdmin() && ! $actor->isSuperAdmin()) {
            throw new ApiException('Super admin ki permission nahi badal sakte.', 403, 'FORBIDDEN_TARGET');
        }

        if (! $actor->isSuperAdmin() && (int) $target->company_id !== (int) $actor->company_id) {
            throw new ApiException('Ye user aapki company ka nahi hai.', 403, 'FORBIDDEN_TARGET');
        }
    }

    /** Jo khud ke paas nahi, wo kisi aur ko de nahi sakte. */
    private function assertAssignable(array $slugs, User $actor): void
    {
        if ($actor->isSuperAdmin()) {
            return;
        }

        $extra = array_values(array_diff($slugs, $actor->permissionSlugs()));

        if ($extra !== []) {
            throw new ApiException(
                'Ye permission aapke paas hi nahi hai: ' . implode(', ', $extra),
                403,
                'PERMISSION_ESCALATION'
            );
        }
    }

    private function assertNotLockingSelf(User $target, User $actor, array $revokes): void
    {
        if ((int) $target->id !== (int) $actor->id) {
            return;
        }

        if (in_array(self::MANAGE_PERMISSION, $revokes, true)) {
            throw new ApiException(
                'Apne aap se permission dene ka haq nahi hata sakte.',
                409,
                'PERMISSION_SELF_LOCK'
            );
        }
    }

    private function assertSuperAdmin(User $actor, string $what): void
    {
        if (! $actor->isSuperAdmin()) {
            throw new ApiException('Sirf super admin ' . $what . ' ka haq rakhta hai.', 403, 'FORBIDDEN');
        }
    }

    private function disabledModules(?int $companyId): array
    {
        if ($companyId === null) {
            return [];
        }

        return DB::table('company_modules')
            ->where('company_id', $companyId)
            ->where('is_enabled', 0)
            ->pluck('module')
            ->all();
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::PERMISSIONS, TenantCache::USERS);
    }

    /**
     * Super admin doosri company ka module badalta hai, isliye uske tenant scope
     * wali cache se kaam nahi chalega — pura cache saaf karna padta hai.
     */
    private function flushAll(): void
    {
        Cache::flush();
    }
}

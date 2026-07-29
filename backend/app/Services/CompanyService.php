<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final class CompanyService
{
    public const ADMIN_PERMISSIONS = [
        'company.view',
        'company.edit',
        'branch.view',
        'branch.create',
        'branch.edit',
        'branch.delete',
        'department.view',
        'department.create',
        'department.edit',
        'department.delete',
        'team.view',
        'team.create',
        'team.edit',
        'team.delete',
        'designation.view',
        'designation.create',
        'designation.edit',
        'designation.delete',
        'employee.view',
        'employee.create',
        'employee.edit',
        'employee.delete',
        'employee_family.view',
        'employee_family.manage',
        'employee_bank.view',
        'employee_bank.manage',
        'role.view',
        'role.create',
        'role.edit',
        'role.delete',
        'user.view',
        'user.create',
        'user.edit',
        'user.delete',

        'user.view_all',
        'permission.view',
    ];

    public function create(array $data, User $actor): Company
    {
        return DB::transaction(function () use ($data, $actor): Company {
            $company = new Company(Arr::except($data, ['admin']));
            $company->created_by = $actor->id;
            $company->employee_count = 1;
            $company->save();

            $role = $this->createAdminRole($company, $actor);
            $admin = $this->createAdminUser($company, $role, $data['admin'], $actor);

            TenantCache::flush(TenantCache::COMPANIES);

            return $company->setRelation('adminUser', $admin);
        });
    }

    public function update(Company $company, array $data, User $actor): Company
    {
        $company->fill($data);
        $company->updated_by = $actor->id;
        $company->save();

        TenantCache::flush(TenantCache::COMPANIES);

        return $company->refresh();
    }

    public function delete(Company $company): void
    {
        DB::transaction(function () use ($company): void {
            User::query()->withoutGlobalScopes()->where('company_id', $company->id)->each(function (User $user): void {
                $user->revokeTokens();
                $user->delete();
            });

            $company->forceFill(['status' => 'archived'])->save();
            $company->delete();

            TenantCache::flush(TenantCache::COMPANIES);
        });
    }

    private function createAdminRole(Company $company, User $actor): Role
    {
        $role = new Role([
            'name' => 'Company Admin',
            'slug' => Role::COMPANY_ADMIN,
            'description' => 'Full control over this company workspace',
            'hierarchy_level' => 2,
            'data_scope' => 'all_company',
        ]);

        $role->company_id = $company->id;
        $role->is_system = true;
        $role->created_by = $actor->id;
        $role->save();

        $role->permissions()->sync(
            Permission::query()->whereIn('slug', self::ADMIN_PERMISSIONS)->pluck('id')->all()
        );

        return $role;
    }

    private function createAdminUser(Company $company, Role $role, array $data, User $actor): User
    {
        $admin = new User([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
        ]);

        $admin->company_id = $company->id;
        $admin->created_by = $actor->id;
        $admin->save();

        $admin->roles()->attach($role->id, [
            'company_id' => $company->id,
            'assigned_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $admin->setRelation('roles', collect([$role]));
    }
}

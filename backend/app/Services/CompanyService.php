<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Company;
use App\Models\Employee;
use App\Models\LeaveType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\TicketCategory;
use App\Models\TicketCategoryRoute;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CompanyService
{
    public const PLATFORM_ONLY_PERMISSIONS = [
        'company.create',
        'company.delete',
    ];

    private const CODE_PREFIX = 'EMP';

    private const TICKET_SLAS = [
        ['urgent', 1, 4],
        ['high', 4, 24],
        ['medium', 8, 48],
        ['low', 24, 120],
    ];

    private const TICKET_CATEGORIES = [
        ['Salary / Payslip', 'salary', 'internal', 'medium', [
            ['department', 'HR', null, true],
        ]],
        ['Leave / Attendance', 'leave', 'internal', 'medium', [
            ['manager', 'Mera Manager', 'Approval, adjustment ya planning ka sawal', true],
            ['department', 'HR', 'Balance galat hai ya policy ka sawal hai', false],
        ]],
        ['Work / Task / Project', 'work', 'internal', 'medium', [
            ['manager', 'Mera Manager', null, true],
        ]],
        ['IT / Laptop / System', 'it', 'internal', 'high', [
            ['department', 'IT', null, true],
        ]],
        ['Policy / Document', 'policy', 'internal', 'low', [
            ['department', 'HR', null, true],
        ]],
        ['Office / Facility', 'facility', 'internal', 'medium', [
            ['department', 'Admin', null, true],
        ]],
        ['Kuch aur', 'other', 'internal', 'low', [
            ['manager', 'Mera Manager', null, false],
            ['department', 'HR', null, false],
            ['department', 'IT', null, false],
        ]],
        ['Billing / Plan', 'billing', 'platform', 'high', [
            ['super_admin', 'Clanio Support', null, true],
        ]],
        ['Technical Issue', 'technical', 'platform', 'high', [
            ['super_admin', 'Clanio Support', null, true],
        ]],
        ['Feature Request', 'feature', 'platform', 'low', [
            ['super_admin', 'Clanio Support', null, true],
        ]],
        ['Account / Data', 'account', 'platform', 'medium', [
            ['super_admin', 'Clanio Support', null, true],
        ]],
    ];

    public function __construct(private readonly PolicyService $policies) {}

    public function create(array $data, User $actor): Company
    {
        return DB::transaction(function () use ($data, $actor): Company {
            $company = new Company(Arr::except($data, ['admin']));
            $company->created_by = $actor->id;
            $company->employee_count = 1;
            $company->save();

            $role = $this->createAdminRole($company, $actor);
            $admin = $this->createAdminUser($company, $role, $data['admin'], $actor);
            $this->createAdminEmployee($company, $admin, $data['admin'], $actor);
            $this->createLeaveTypes($company, $actor);
            $this->createTicketDefaults($company, $actor);
            $this->enableModules($company);

            TenantCache::flush(
                TenantCache::COMPANIES,
                TenantCache::LEAVE_TYPES,
                TenantCache::EMPLOYEES,
                TenantCache::PERMISSIONS
            );

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
                $user->deactivate();
            });

            $company->forceFill(['status' => 'archived'])->save();
            $company->deactivate();

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
            Permission::query()->whereNotIn('slug', self::PLATFORM_ONLY_PERMISSIONS)->pluck('id')->all()
        );

        return $role;
    }

    private function createAdminEmployee(Company $company, User $admin, array $data, User $actor): Employee
    {
        $employee = new Employee([
            'date_of_joining' => $data['date_of_joining'] ?? Carbon::today()->toDateString(),
            'employment_type' => 'full_time',
        ]);

        $employee->company_id = $company->id;
        $employee->user_id = $admin->id;
        $employee->employee_code = self::CODE_PREFIX . '0001';
        $employee->onboarding_status = Employee::ONBOARDING_COMPLETED;
        $employee->created_by = $actor->id;
        $employee->save();

        $this->policies->assignPending($employee, $actor);

        return $employee;
    }

    private function createTicketDefaults(Company $company, User $actor): void
    {
        $now = Carbon::now();

        DB::table('ticket_slas')->insertOrIgnore(array_map(fn (array $row): array => [
            'company_id' => $company->id,
            'priority' => $row[0],
            'response_hours' => $row[1],
            'resolution_hours' => $row[2],
            'created_at' => $now,
            'updated_at' => $now,
        ], self::TICKET_SLAS));

        foreach (self::TICKET_CATEGORIES as $order => [$name, $code, $scope, $priority, $routes]) {
            $category = new TicketCategory([
                'name' => $name,
                'code' => $code,
                'scope' => $scope,
                'default_priority' => $priority,
                'sort_order' => $order + 1,
            ]);

            $category->company_id = $company->id;
            $category->is_system = true;
            $category->created_by = $actor->id;
            $category->save();

            foreach ($routes as $index => [$target, $label, $hint, $isDefault]) {
                $route = new TicketCategoryRoute([
                    'route_to' => $target,
                    'label' => $label,
                    'hint' => $hint,
                    'is_default' => $isDefault,
                    'sort_order' => $index + 1,
                ]);

                $route->company_id = $company->id;
                $route->category_id = $category->id;
                $route->created_by = $actor->id;
                $route->save();
            }
        }
    }

    private function enableModules(Company $company): void
    {
        $now = Carbon::now();

        $rows = DB::table('permissions')
            ->distinct()
            ->pluck('module')
            ->map(fn (string $module): array => [
                'company_id' => $company->id,
                'module' => $module,
                'is_enabled' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();

        if ($rows !== []) {
            DB::table('company_modules')->insertOrIgnore($rows);
        }
    }

    private function createLeaveTypes(Company $company, User $actor): void
    {
        foreach (LeaveType::DEFAULTS as $defaults) {
            $type = new LeaveType($defaults);
            $type->company_id = $company->id;
            $type->created_by = $actor->id;
            $type->save();
        }
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

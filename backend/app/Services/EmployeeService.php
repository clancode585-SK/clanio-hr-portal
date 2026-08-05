<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final class EmployeeService
{
    private const CODE_PREFIX = 'EMP';

    public function __construct(private readonly UserService $users) {}

    public function create(array $data, User $actor, ?int $companyId): Employee
    {
        if ($companyId === null) {
            throw new ApiException(
                'An employee belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return DB::transaction(function () use ($data, $actor, $companyId): Employee {
            $user = isset($data['user'])
                ? $this->users->create($data['user'], $actor, $companyId)
                : $this->linkExistingUser((int) $data['user_id']);

            $employee = new Employee(Arr::except($data, ['user', 'user_id', 'employee_code']));
            $employee->company_id = $companyId;
            $employee->user_id = $user->id;
            $employee->employee_code = $data['employee_code'] ?? $this->nextCode($companyId);
            $employee->created_by = $actor->id;

            $this->assertManagerIsNotSelf($employee, $user->id);
            $employee->save();

            TenantCache::flush(TenantCache::EMPLOYEES);

            return $employee->load('user.roles', 'designation');
        });
    }

    public function update(Employee $employee, array $data, User $actor): Employee
    {
        $employee->fill($data);
        $employee->updated_by = $actor->id;

        $this->assertManagerIsNotSelf($employee, $employee->user_id);
        $employee->save();

        TenantCache::flush(TenantCache::EMPLOYEES);

        return $employee->refresh()->load('user.roles', 'designation');
    }

    public function delete(Employee $employee): void
    {
        DB::transaction(function () use ($employee): void {
            $employee->familyMembers()->update(['is_active' => 0]);
            $employee->bankAccounts()->update(['is_active' => 0]);
            $employee->deactivate();

            TenantCache::flush(TenantCache::EMPLOYEES);
        });
    }

    public function completeOnboarding(Employee $employee, User $actor): Employee
    {
        $missing = [];

        if (! $employee->bankAccounts()->exists()) {
            $missing[] = 'bank account';
        }

        if ($employee->designation_id === null) {
            $missing[] = 'designation';
        }

        $uploaded = $employee->documents()->pluck('type')->unique()->all();

        foreach (array_diff(EmployeeDocument::REQUIRED_FOR_ONBOARDING, $uploaded) as $type) {
            $missing[] = EmployeeDocument::TYPES[$type] ?? $type;
        }

        if ($missing !== []) {
            throw new ApiException(
                'Onboarding is not complete yet. Missing: ' . implode(', ', $missing) . '.',
                409,
                'ONBOARDING_INCOMPLETE'
            );
        }

        $employee->forceFill([
            'onboarding_status' => Employee::ONBOARDING_COMPLETED,
            'updated_by' => $actor->id,
        ])->save();

        TenantCache::flush(TenantCache::EMPLOYEES);

        return $employee->refresh();
    }

    private function linkExistingUser(int $userId): User
    {
        $user = User::query()->findOrFail($userId);

        if ($user->isSuperAdmin()) {
            throw new ApiException('A platform super admin cannot be an employee.', 422, 'USER_NOT_EMPLOYABLE');
        }

        return $user;
    }

    private function assertManagerIsNotSelf(Employee $employee, int $userId): void
    {
        if ($employee->reporting_manager_id !== null && (int) $employee->reporting_manager_id === $userId) {
            throw new ApiException('An employee cannot report to themselves.', 422, 'MANAGER_INVALID');
        }
    }

    private function nextCode(int $companyId): string
    {
        $last = DB::table('employees')
            ->where('company_id', $companyId)
            ->where('employee_code', 'like', self::CODE_PREFIX . '%')
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('employee_code');

        $next = $last === null ? 1 : ((int) substr($last, strlen(self::CODE_PREFIX))) + 1;

        return self::CODE_PREFIX . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}

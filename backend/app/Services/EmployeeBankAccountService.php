<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeBankAccount;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Facades\DB;

final class EmployeeBankAccountService
{
    public function create(Employee $employee, array $data, User $actor): EmployeeBankAccount
    {
        $this->assertNotDuplicate($employee, $data['account_number']);

        return DB::transaction(function () use ($employee, $data, $actor): EmployeeBankAccount {
            $account = new EmployeeBankAccount($data);
            $account->company_id = $employee->company_id;
            $account->employee_id = $employee->id;
            $account->created_by = $actor->id;

            if (! $employee->bankAccounts()->exists()) {
                $account->is_primary = true;
            }

            $account->save();
            $this->keepSinglePrimary($employee, $account);

            TenantCache::flush(TenantCache::EMPLOYEES);

            return $account;
        });
    }

    public function update(EmployeeBankAccount $account, array $data, User $actor): EmployeeBankAccount
    {
        if (isset($data['account_number'])) {
            $this->assertNotDuplicate($account->employee, $data['account_number'], $account->id);
        }

        return DB::transaction(function () use ($account, $data, $actor): EmployeeBankAccount {
            $account->fill($data);
            $account->updated_by = $actor->id;
            $account->save();

            $this->keepSinglePrimary($account->employee, $account);

            TenantCache::flush(TenantCache::EMPLOYEES);

            return $account->refresh();
        });
    }

    public function delete(EmployeeBankAccount $account): void
    {
        if ($account->is_primary && $account->employee->bankAccounts()->count() > 1) {
            throw new ApiException(
                'Make another account primary before deleting this one.',
                409,
                'PRIMARY_ACCOUNT_LOCKED'
            );
        }

        $account->delete();

        TenantCache::flush(TenantCache::EMPLOYEES);
    }

    private function keepSinglePrimary(Employee $employee, EmployeeBankAccount $account): void
    {
        if (! $account->is_primary) {
            return;
        }

        $employee->bankAccounts()
            ->whereKeyNot($account->id)
            ->where('is_primary', true)
            ->update(['is_primary' => false]);
    }

    private function assertNotDuplicate(Employee $employee, string $accountNumber, ?int $ignoreId = null): void
    {
        $exists = $employee->bankAccounts()
            ->where('account_number', $accountNumber)
            ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();

        if ($exists) {
            throw new ApiException('This account number is already saved for the employee.', 422, 'BANK_ACCOUNT_DUPLICATE');
        }
    }
}

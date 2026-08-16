<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Department;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Facades\DB;

final class DepartmentService
{
    public function create(array $data, User $actor, ?int $companyId): Department
    {
        if ($companyId === null) {
            throw new ApiException(
                'A department belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        $department = new Department($data);
        $department->company_id = $companyId;
        $department->created_by = $actor->id;
        $department->save();

        TenantCache::flush(TenantCache::DEPARTMENTS);

        return $department;
    }

    public function update(Department $department, array $data, User $actor): Department
    {
        $department->fill($data);
        $department->updated_by = $actor->id;
        $department->save();

        TenantCache::flush(TenantCache::DEPARTMENTS);

        return $department->refresh();
    }

    public function delete(Department $department): void
    {
        DB::transaction(function () use ($department): void {
            $department->teams()->delete();
            $department->users()->update(['department_id' => null]);
            $department->delete();

            TenantCache::flush(TenantCache::DEPARTMENTS);
        });
    }
}

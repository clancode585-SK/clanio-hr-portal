<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Department;
use App\Models\User;
use App\Support\TenantCache;

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
        if ($department->teams()->exists()) {
            throw new ApiException(
                'This department has teams. Delete or move them first.',
                409,
                'DEPARTMENT_IN_USE'
            );
        }

        if ($department->users()->exists()) {
            throw new ApiException(
                'This department has users. Move them before deleting it.',
                409,
                'DEPARTMENT_IN_USE'
            );
        }

        $department->delete();

        TenantCache::flush(TenantCache::DEPARTMENTS);
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Branch;
use App\Models\User;
use App\Support\TenantCache;

final class BranchService
{
    public function create(array $data, User $actor, ?int $companyId): Branch
    {
        if ($companyId === null) {
            throw new ApiException(
                'A branch belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        $branch = new Branch($data);
        $branch->company_id = $companyId;
        $branch->created_by = $actor->id;
        $branch->save();

        TenantCache::flush(TenantCache::BRANCHES);

        return $branch;
    }

    public function update(Branch $branch, array $data, User $actor): Branch
    {
        $branch->fill($data);
        $branch->updated_by = $actor->id;
        $branch->save();

        TenantCache::flush(TenantCache::BRANCHES);

        return $branch->refresh();
    }

    public function delete(Branch $branch): void
    {
        if ($branch->users()->exists()) {
            throw new ApiException('This branch has users. Move them before deleting it.', 409, 'BRANCH_IN_USE');
        }

        $branch->deactivate();

        TenantCache::flush(TenantCache::BRANCHES);
    }
}

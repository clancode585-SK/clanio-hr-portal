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
        $targetCompanyId = $companyId ?? $actor->company_id ?? 1;

        $branch = new Branch($data);
        $branch->company_id = $targetCompanyId;
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

        $branch->delete();

        TenantCache::flush(TenantCache::BRANCHES);
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Designation;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Facades\DB;

final class DesignationService
{
    public function create(array $data, User $actor, ?int $companyId): Designation
    {
        if ($companyId === null) {
            throw new ApiException(
                'A designation belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        $designation = new Designation($data);
        $designation->company_id = $companyId;
        $designation->created_by = $actor->id;
        $designation->save();

        TenantCache::flush(TenantCache::DESIGNATIONS);

        return $designation;
    }

    public function update(Designation $designation, array $data, User $actor): Designation
    {
        $designation->fill($data);
        $designation->updated_by = $actor->id;
        $designation->save();

        TenantCache::flush(TenantCache::DESIGNATIONS);

        return $designation->refresh();
    }

    public function delete(Designation $designation): void
    {
        DB::transaction(function () use ($designation): void {
            $designation->employees()->update(['designation_id' => null]);
            $designation->delete();

            TenantCache::flush(TenantCache::DESIGNATIONS);
        });
    }
}

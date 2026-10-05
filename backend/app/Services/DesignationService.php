<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Designation;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Support\Str;

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
        $designation->code = $this->uniqueCode($data['name'], $companyId);
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
        if ($designation->employees()->exists()) {
            throw new ApiException(
                'This designation is assigned to employees. Reassign them first.',
                409,
                'DESIGNATION_IN_USE'
            );
        }

        $designation->deactivate();

        TenantCache::flush(TenantCache::DESIGNATIONS);
    }

    /** Form ab code nahi maangta — naam se hi bana lete hain, takrao ho to number jod dete hain */
    private function uniqueCode(string $name, int $companyId): string
    {
        $base = Str::upper(Str::slug($name, '_'));
        $base = $base === '' ? 'ROLE' : $base;
        $code = $base;
        $suffix = 1;

        while (Designation::query()->where('company_id', $companyId)->where('code', $code)->where('is_active', 1)->exists()) {
            $suffix++;
            $code = $base . '_' . $suffix;
        }

        return $code;
    }
}

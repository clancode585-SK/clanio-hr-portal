<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\LeaveType;
use App\Models\User;
use App\Support\TenantCache;

final class LeaveTypeService
{
    public function create(array $data, User $actor, ?int $companyId): LeaveType
    {
        if ($companyId === null) {
            throw new ApiException(
                'A leave type belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        $type = new LeaveType($data);
        $type->company_id = $companyId;
        $type->created_by = $actor->id;
        $type->save();

        $this->flush();

        return $type;
    }

    public function update(LeaveType $type, array $data, User $actor): LeaveType
    {
        $type->fill($data);
        $type->updated_by = $actor->id;
        $type->save();

        $this->flush();

        return $type->refresh();
    }

    public function delete(LeaveType $type): void
    {
        if ($type->requests()->exists()) {
            throw new ApiException(
                'This leave type is already used in leave requests. Make it inactive instead.',
                409,
                'LEAVE_TYPE_IN_USE'
            );
        }

        $type->balances()->delete();
        $type->deactivate();

        $this->flush();
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::LEAVE_TYPES, TenantCache::LEAVE_BALANCES);
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeBankAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $canSeeFullNumber = $request->user()?->hasPermission('employee_bank.manage') === true;

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_id' => $this->employee_id,
            'account_holder_name' => $this->account_holder_name,
            'bank_name' => $this->bank_name,
            'account_number' => $canSeeFullNumber ? $this->account_number : $this->maskedAccountNumber(),
            'account_number_masked' => ! $canSeeFullNumber,
            'ifsc_code' => $this->ifsc_code,
            'branch_name' => $this->branch_name,
            'account_type' => $this->account_type,
            'is_primary' => $this->is_primary,
            'created_at' => $this->created_at,
        ];
    }
}

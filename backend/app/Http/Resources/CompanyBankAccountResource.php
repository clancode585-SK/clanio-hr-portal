<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompanyBankAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'label' => $this->label,
            'account_holder_name' => $this->account_holder_name,
            'bank_name' => $this->bank_name,
            'account_number' => $this->account_number,
            'account_masked' => $this->masked(),
            'ifsc_code' => $this->ifsc_code,
            'branch_name' => $this->branch_name,
            'contact_email' => $this->contact_email,
            'provider' => $this->provider,
            'is_primary' => $this->is_primary,
            'balance' => $this->balance,
            'balance_words' => Money::indian($this->balance, 2),
            'balance_synced_at' => $this->balance_synced_at,
            'status' => $this->is_active ? 'active' : 'archived',
        ];
    }
}

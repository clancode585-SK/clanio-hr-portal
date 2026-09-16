<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalaryDisbursementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'run_id' => (int) $this->run_id,
            'item_id' => (int) $this->item_id,
            'employee_code' => $this->employee_code,
            'employee_name' => $this->employee_name,

            'to_account_holder' => $this->to_account_holder,
            'to_bank_name' => $this->to_bank_name,
            'to_account_masked' => $this->maskedPayee(),
            'to_ifsc_code' => $this->to_ifsc_code,

            'amount' => $this->amount,
            'amount_words' => Money::indian($this->amount, 2),
            'provider' => $this->provider,
            'mode' => $this->mode,
            'reference' => $this->reference,
            'utr' => $this->utr,

            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            'failure_reason' => $this->failure_reason,

            'initiated_at' => $this->initiated_at,
            'completed_at' => $this->completed_at,
        ];
    }
}

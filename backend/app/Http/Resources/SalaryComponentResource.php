<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalaryComponentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'code' => $this->code,
            'name' => $this->name,
            'kind' => $this->kind,
            'kind_label' => $this->kindLabel(),
            'calculation' => $this->calculation,
            'default_value' => $this->default_value,
            'is_taxable' => $this->is_taxable,
            'is_statutory' => $this->is_statutory,
            'affects_net' => $this->affects_net,
            'sequence' => $this->sequence,
            'note' => $this->note,
            'status' => $this->is_active ? 'active' : 'archived',
        ];
    }
}

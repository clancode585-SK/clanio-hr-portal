<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetAllocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'asset_id' => (int) $this->asset_id,
            'asset_code' => $this->asset?->asset_code,
            'asset_name' => $this->asset?->name,
            'asset_category' => $this->asset?->category,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'employee_code' => $this->employee?->employee_code,

            'status' => $this->status,
            'allocated_on' => $this->allocated_on?->format('Y-m-d'),
            'expected_return_date' => $this->expected_return_date?->format('Y-m-d'),
            'allocation_condition' => $this->allocation_condition,
            'allocation_remarks' => $this->allocation_remarks,
            'allocated_by_name' => $this->allocator?->name,

            'returned_on' => $this->returned_on?->format('Y-m-d'),
            'return_condition' => $this->return_condition,
            'return_remarks' => $this->return_remarks,
            'received_by_name' => $this->receiver?->name,
            'recoverable_amount' => (float) $this->recoverable_amount,

            'created_at' => $this->created_at,
        ];
    }
}

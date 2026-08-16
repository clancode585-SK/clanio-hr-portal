<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $canManage = (bool) $request->user()?->hasPermission(Asset::MANAGE_PERMISSION);

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'asset_code' => $this->asset_code,
            'category' => $this->category,
            'category_label' => $this->categoryLabel(),
            'name' => $this->name,
            'brand' => $this->brand,
            'model' => $this->model,
            'serial_number' => $this->serial_number,
            'purchase_date' => $this->purchase_date?->format('Y-m-d'),
            'purchase_cost' => $this->purchase_cost,
            'warranty_expiry' => $this->warranty_expiry?->format('Y-m-d'),
            'condition_state' => $this->condition_state,
            'status' => $this->status,
            'notes' => $this->notes,

            'allocated_to' => $this->whenLoaded('currentAllocation', fn () => $this->currentAllocation === null ? null : [
                'allocation_id' => (int) $this->currentAllocation->id,
                'employee_id' => (int) $this->currentAllocation->employee_id,
                'employee_name' => $this->currentAllocation->employee?->user?->name,
                'employee_code' => $this->currentAllocation->employee?->employee_code,
                'allocated_on' => $this->currentAllocation->allocated_on?->format('Y-m-d'),
                'expected_return_date' => $this->currentAllocation->expected_return_date?->format('Y-m-d'),
            ]),

            'can' => [
                'allocate' => $canManage && $this->isAvailable(),
                'return' => $canManage && $this->isAllocated(),
                'retire' => $canManage && ! $this->isAllocated() && ! $this->isRetired(),
            ],

            'created_at' => $this->created_at,
        ];
    }
}

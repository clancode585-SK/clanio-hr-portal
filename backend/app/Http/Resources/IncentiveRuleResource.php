<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncentiveRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'role_id' => $this->role_id === null ? null : (int) $this->role_id,
            'role_name' => $this->role?->name,
            'applies_to' => $this->role_id === null ? 'Sabke liye (default)' : $this->role?->name,
            'base_percent' => $this->base_percent,
            'period_type' => $this->period_type,
            'description' => $this->description,
            'slabs' => $this->whenLoaded('slabs', fn (): array => $this->slabs
                ->map(fn ($slab): array => [
                    'from_percent' => $slab->from_percent,
                    'to_percent' => $slab->to_percent,
                    'payout_factor' => $slab->payout_factor,
                    'label' => $slab->label,
                ])->all()),
            'created_at' => $this->created_at,
        ];
    }
}

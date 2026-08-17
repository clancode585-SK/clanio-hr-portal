<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'code' => $this->code,
            'scope' => $this->scope,
            'default_priority' => $this->default_priority,
            'support_email' => $this->support_email,
            'response_hours' => $this->response_hours,
            'resolution_hours' => $this->resolution_hours,
            'sort_order' => $this->sort_order,
            'is_system' => (bool) $this->is_system,
            'is_active' => (bool) $this->is_active,
            'routes' => TicketCategoryRouteResource::collection($this->whenLoaded('routes')),
        ];
    }
}

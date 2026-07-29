<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DepartmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'branch_id' => $this->branch_id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'status' => $this->status,
            'teams_count' => $this->whenCounted('teams'),
            'users_count' => $this->whenCounted('users'),
            'teams' => TeamResource::collection($this->whenLoaded('teams')),
            'created_at' => $this->created_at,
        ];
    }
}

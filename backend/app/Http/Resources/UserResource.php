<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'branch_id' => $this->branch_id,
            'department_id' => $this->department_id,
            'team_id' => $this->team_id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'is_super_admin' => $this->is_super_admin,
            'last_login_at' => $this->last_login_at,
            'roles' => RoleResource::collection($this->whenLoaded('roles')),
            'department' => new DepartmentResource($this->whenLoaded('department')),
            'team' => new TeamResource($this->whenLoaded('team')),
            'created_at' => $this->created_at,
        ];
    }
}

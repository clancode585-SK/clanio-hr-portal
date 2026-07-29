<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DesignationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'department_id' => $this->department_id,
            'name' => $this->name,
            'code' => $this->code,
            'level' => $this->level,
            'description' => $this->description,
            'status' => $this->status,
            'employees_count' => $this->whenCounted('employees'),
            'department' => new DepartmentResource($this->whenLoaded('department')),
            'created_at' => $this->created_at,
        ];
    }
}

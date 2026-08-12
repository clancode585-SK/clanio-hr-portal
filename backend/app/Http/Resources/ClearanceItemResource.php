<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClearanceItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'department' => $this->department,
            'department_label' => $this->departmentLabel(),
            'title' => $this->title,
            'description' => $this->description,
            'is_recoverable' => $this->is_recoverable,
            'is_mandatory' => $this->is_mandatory,
            'sort_order' => $this->sort_order,
            'created_at' => $this->created_at,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeFamilyMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_id' => $this->employee_id,
            'name' => $this->name,
            'relation' => $this->relation,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'occupation' => $this->occupation,
            'phone' => $this->phone,
            'is_dependent' => $this->is_dependent,
            'is_nominee' => $this->is_nominee,
            'nominee_share' => $this->nominee_share,
            'created_at' => $this->created_at,
        ];
    }
}

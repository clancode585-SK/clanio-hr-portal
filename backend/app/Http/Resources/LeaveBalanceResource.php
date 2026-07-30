<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveBalanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_id' => $this->employee_id,
            'leave_type_id' => $this->leave_type_id,
            'year' => $this->year,
            'opening' => $this->opening,
            'accrued' => $this->accrued,
            'used' => $this->used,
            'encashed' => $this->encashed,
            'adjusted' => $this->adjusted,
            'available' => (float) $this->available,
            'last_accrued_on' => $this->last_accrued_on,
            'leave_type' => new LeaveTypeResource($this->whenLoaded('leaveType')),
            'employee' => new EmployeeResource($this->whenLoaded('employee')),
            'created_at' => $this->created_at,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkShiftResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'code' => $this->code,
            'start_time' => substr((string) $this->start_time, 0, 5),
            'end_time' => substr((string) $this->end_time, 0, 5),
            'grace_minutes' => $this->grace_minutes,
            'half_day_minutes' => $this->half_day_minutes,
            'full_day_minutes' => $this->full_day_minutes,
            'weekly_offs' => $this->weeklyOffDays(),
            'weekly_off_days' => $this->weeklyOffNames(),
            'is_default' => $this->is_default,
            'status' => $this->status,
            'employees_count' => $this->whenCounted('employees'),
            'created_at' => $this->created_at,
        ];
    }
}

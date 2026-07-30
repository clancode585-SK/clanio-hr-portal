<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveRequestDayResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'leave_date' => $this->leave_date?->format('Y-m-d'),
            'weekday' => $this->leave_date?->format('l'),
            'day_portion' => $this->day_portion,
            'session' => $this->session,
            'status' => $this->status,
        ];
    }
}

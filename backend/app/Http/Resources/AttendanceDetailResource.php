<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Attendance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $minutes = $this->worked_minutes ?? $this->elapsedMinutes();

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'attendance_id' => $this->attendance_id,
            'check_in_at' => $this->check_in_at?->toDateTimeString(),
            'check_in_latitude' => $this->check_in_latitude,
            'check_in_longitude' => $this->check_in_longitude,
            'check_in_ip' => $this->check_in_ip,
            'check_out_at' => $this->check_out_at?->toDateTimeString(),
            'check_out_latitude' => $this->check_out_latitude,
            'check_out_longitude' => $this->check_out_longitude,
            'check_out_ip' => $this->check_out_ip,
            'is_open' => $this->isOpen(),
            'worked_minutes' => $minutes,
            'worked_human' => Attendance::humanDuration($minutes),
            'source' => $this->source,
        ];
    }
}

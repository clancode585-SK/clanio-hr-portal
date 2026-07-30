<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Attendance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $open = $this->relationLoaded('openDetail') ? $this->openDetail : null;
        $liveMinutes = $this->worked_minutes + ($open?->elapsedMinutes() ?? 0);

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'employee_id' => $this->employee_id,
            'attendance_date' => $this->attendance_date?->format('Y-m-d'),

            'first_check_in_at' => $this->first_check_in_at?->toDateTimeString(),
            'last_check_out_at' => $this->last_check_out_at?->toDateTimeString(),

            'is_checked_in' => $open !== null,
            'can_check_in' => $open === null,
            'can_check_out' => $open !== null,
            'running_since' => $open?->check_in_at?->toDateTimeString(),
            'running_seconds' => $open === null ? 0 : max(0, (int) $open->check_in_at->diffInSeconds(now())),

            'worked_minutes' => $liveMinutes,
            'worked_human' => Attendance::humanDuration($liveMinutes),
            'break_minutes' => $this->break_minutes,
            'punch_count' => $this->punch_count,

            'status' => $this->status,
            'source' => $this->source,
            'is_late' => $this->is_late,
            'late_minutes' => $this->late_minutes,
            'leave_portion' => (float) $this->leave_portion,

            'work_shift_id' => $this->work_shift_id,
            'work_shift' => new WorkShiftResource($this->whenLoaded('workShift')),
            'employee' => new EmployeeResource($this->whenLoaded('employee')),
            'details' => AttendanceDetailResource::collection($this->whenLoaded('details')),

            'created_at' => $this->created_at,
        ];
    }
}

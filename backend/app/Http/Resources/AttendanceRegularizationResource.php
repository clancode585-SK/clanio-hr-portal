<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceRegularizationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'employee_code' => $this->employee?->employee_code,
            'attendance_date' => $this->attendance_date,
            'type' => $this->type,
            'type_label' => $this->typeLabel(),
            'reason' => $this->reason,
            'status' => $this->status,
            'requested' => [
                'check_in' => $this->requested_check_in,
                'check_out' => $this->requested_check_out,
            ],
            'previous' => [
                'check_in' => $this->previous_check_in,
                'check_out' => $this->previous_check_out,
                'status' => $this->previous_status,
            ],
            'decision' => [
                'approver_id' => $this->approver_id === null ? null : (int) $this->approver_id,
                'approver_name' => $this->approver?->name,
                'decided_at' => $this->decided_at,
                'remarks' => $this->decision_remarks,
            ],
            'attendance_id' => $this->attendance_id === null ? null : (int) $this->attendance_id,
            'attendance_status' => $this->attendance?->status,
            'is_pending' => $this->isPending(),
            'created_at' => $this->created_at,
        ];
    }
}

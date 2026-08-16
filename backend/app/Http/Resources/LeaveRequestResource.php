<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\LeaveRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'employee_id' => $this->employee_id,
            'leave_type_id' => $this->leave_type_id,

            'from_date' => $this->from_date?->format('Y-m-d'),
            'to_date' => $this->to_date?->format('Y-m-d'),
            'day_count' => $this->day_count,
            'is_half_day' => $this->is_half_day,
            'half_day_session' => $this->half_day_session,

            'reason' => $this->reason,
            'contact_number' => $this->contact_number,
            'document_id' => $this->document_id,

            'status' => $this->status,
            'is_pending' => $this->status === LeaveRequest::PENDING,
            'can_cancel' => $this->canCancel(),

            'approver_id' => $this->approver_id,
            'decided_at' => $this->decided_at,
            'decision_remarks' => $this->decision_remarks,
            'cancelled_at' => $this->cancelled_at,

            'leave_type' => new LeaveTypeResource($this->whenLoaded('leaveType')),
            'employee' => new EmployeeResource($this->whenLoaded('employee')),
            'approver' => new UserResource($this->whenLoaded('approver')),
            'days' => LeaveRequestDayResource::collection($this->whenLoaded('days')),

            'created_at' => $this->created_at,
        ];
    }

    private function canCancel(): bool
    {
        if ($this->status === LeaveRequest::PENDING) {
            return true;
        }

        return $this->status === LeaveRequest::APPROVED
            && $this->from_date !== null
            && $this->from_date->greaterThanOrEqualTo(now()->startOfDay());
    }
}

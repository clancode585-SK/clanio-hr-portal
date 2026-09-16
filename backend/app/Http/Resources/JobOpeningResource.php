<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class JobOpeningResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'slug' => $this->slug,
            'title' => $this->title,
            'department_id' => $this->department_id,
            'department' => $this->whenLoaded('department', fn () => $this->department?->name),
            'designation_id' => $this->designation_id,
            'designation' => $this->whenLoaded('designation', fn () => $this->designation?->name),
            'branch_id' => $this->branch_id,
            'branch' => $this->whenLoaded('branch', fn () => $this->branch?->name),
            'location' => $this->location,
            'work_mode' => $this->work_mode,
            'employment_type' => $this->employment_type,
            'experience_min' => $this->experience_min,
            'experience_max' => $this->experience_max,
            'experience_label' => $this->experienceLabel(),
            'positions' => $this->positions,
            'salary_min' => $this->salary_min,
            'salary_max' => $this->salary_max,
            'show_salary' => $this->show_salary,
            'summary' => $this->summary,
            'responsibilities' => $this->responsibilities,
            'requirements' => $this->requirements,
            'nice_to_have' => $this->nice_to_have,
            'status' => $this->status,
            'needs_approval' => $this->needsApproval(),
            'requested_by' => $this->requested_by,
            'requester' => $this->whenLoaded('requester', fn () => $this->requester?->name),
            'requested_at' => $this->requested_at?->toIso8601String(),
            'request_note' => $this->request_note,
            'approver' => $this->whenLoaded('approver', fn () => $this->approver?->name),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'decline_reason' => $this->decline_reason,
            'is_live' => $this->isLive(),
            'published_at' => $this->published_at?->toIso8601String(),
            'closes_on' => $this->closes_on?->toDateString(),
            'application_count' => $this->applications_count ?? null,
            'open_count' => $this->when(isset($this->open_applications_count), fn () => $this->open_applications_count),
            'created_at' => $this->created_at?->toIso8601String(),
            'is_active' => (bool) $this->is_active,
        ];
    }
}

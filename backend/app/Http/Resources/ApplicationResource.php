<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'stage' => $this->stage,
            'rating' => $this->rating,
            'cover_note' => $this->cover_note,
            'offered_ctc' => $this->offered_ctc,
            'offer_date' => $this->offer_date?->toDateString(),
            'joining_date' => $this->joining_date?->toDateString(),
            'rejection_reason' => $this->rejection_reason,
            'source' => $this->source,
            'source_detail' => $this->source_detail,
            'stage_changed_at' => $this->stage_changed_at?->toIso8601String(),
            'moved_by' => $this->whenLoaded('movedBy', fn () => $this->movedBy?->name),
            'employee_id' => $this->employee_id,
            'applied_at' => $this->created_at?->toIso8601String(),
            'job_opening_id' => $this->job_opening_id,
            'opening' => $this->whenLoaded('opening', fn (): array => [
                'uuid' => $this->opening->uuid,
                'title' => $this->opening->title,
                'location' => $this->opening->location,
                'status' => $this->opening->status,
            ]),
            'candidate_id' => $this->candidate_id,
            'candidate' => $this->whenLoaded('candidate', fn (): array => [
                'uuid' => $this->candidate->uuid,
                'name' => $this->candidate->name,
                'email' => $this->candidate->email,
                'phone' => $this->candidate->phone,
                'total_experience' => $this->candidate->total_experience,
                'current_company' => $this->candidate->current_company,
                'current_location' => $this->candidate->current_location,
                'current_ctc' => $this->candidate->current_ctc,
                'expected_ctc' => $this->candidate->expected_ctc,
                'notice_period_days' => $this->candidate->notice_period_days,
                'linkedin_url' => $this->candidate->linkedin_url,
                'source' => $this->candidate->source,
                'has_resume' => $this->candidate->resume_path !== null,
                'resume_name' => $this->candidate->resume_name,
            ]),
        ];
    }
}

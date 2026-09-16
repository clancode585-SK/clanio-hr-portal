<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfferLetterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'letter_number' => $this->letter_number,
            'application_id' => $this->application_id,
            'candidate_name' => $this->candidate_name,
            'role_title' => $this->role_title,
            'designation' => $this->designation,
            'department' => $this->department,
            'location' => $this->location,
            'employment_type' => $this->employment_type,
            'annual_ctc' => $this->annual_ctc,
            'joining_date' => $this->joining_date?->toDateString(),
            'reporting_to' => $this->reporting_to,
            'probation_months' => $this->probation_months,
            'notice_days' => $this->notice_days,
            'valid_till' => $this->valid_till?->toDateString(),
            'extra_terms' => $this->extra_terms,
            'status' => $this->status,
            'is_open' => $this->isOpen(),
            'has_lapsed' => $this->hasLapsed(),
            'issued_at' => $this->issued_at?->toIso8601String(),
            'responded_at' => $this->responded_at?->toIso8601String(),
            'decline_reason' => $this->decline_reason,
            'signed_by' => $this->whenLoaded('signer', fn () => $this->signer?->name),
            'application' => $this->whenLoaded('application', fn (): array => [
                'uuid' => $this->application->uuid,
                'stage' => $this->application->stage,
                'candidate_uuid' => $this->application->relationLoaded('candidate')
                    ? $this->application->candidate?->uuid
                    : null,
                'candidate_email' => $this->application->relationLoaded('candidate')
                    ? $this->application->candidate?->email
                    : null,
                'opening_uuid' => $this->application->relationLoaded('opening')
                    ? $this->application->opening?->uuid
                    : null,
            ]),
        ];
    }
}

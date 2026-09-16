<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Support\CompanyTime;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InterviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'application_id' => $this->application_id,
            'round_no' => $this->round_no,
            'title' => $this->title,
            'label' => $this->label(),
            'kind' => $this->kind,
            'mode' => $this->mode,
            'interviewer_id' => $this->interviewer_id,
            'interviewer' => $this->whenLoaded('interviewer', fn () => $this->interviewer?->name),
            'interviewer_email' => $this->whenLoaded('interviewer', fn () => $this->interviewer?->email),
            'scheduled_at' => $this->scheduled_at?->toIso8601String(),
            'scheduled_at_local' => CompanyTime::toZone($this->scheduled_at, (int) $this->company_id)
                ?->format('Y-m-d H:i'),
            'ends_at' => $this->endsAt()?->toIso8601String(),
            'ends_at_local' => CompanyTime::toZone($this->endsAt(), (int) $this->company_id)
                ?->format('Y-m-d H:i'),
            'timezone' => CompanyTime::zone((int) $this->company_id),
            'duration_minutes' => $this->duration_minutes,
            'location' => $this->location,
            'meeting_url' => $this->meeting_url,
            'status' => $this->status,
            'verdict' => $this->verdict,
            'rating' => $this->rating,
            'feedback' => $this->feedback,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'is_open' => $this->isOpen(),
            'application' => $this->whenLoaded('application', fn (): array => [
                'uuid' => $this->application->uuid,
                'stage' => $this->application->stage,
                'candidate' => $this->application->relationLoaded('candidate') && $this->application->candidate !== null
                    ? [
                        'uuid' => $this->application->candidate->uuid,
                        'name' => $this->application->candidate->name,
                        'email' => $this->application->candidate->email,
                        'phone' => $this->application->candidate->phone,
                        'has_resume' => $this->application->candidate->resume_path !== null,
                    ]
                    : null,
                'opening' => $this->application->relationLoaded('opening') && $this->application->opening !== null
                    ? [
                        'uuid' => $this->application->opening->uuid,
                        'title' => $this->application->opening->title,
                        'location' => $this->application->opening->location,
                    ]
                    : null,
            ]),
        ];
    }
}

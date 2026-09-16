<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CandidateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'total_experience' => $this->total_experience,
            'current_company' => $this->current_company,
            'current_location' => $this->current_location,
            'current_ctc' => $this->current_ctc,
            'expected_ctc' => $this->expected_ctc,
            'notice_period_days' => $this->notice_period_days,
            'linkedin_url' => $this->linkedin_url,
            'source' => $this->source,
            'source_detail' => $this->source_detail,
            'referred_by' => $this->referred_by,
            'referrer' => $this->whenLoaded('referrer', fn () => $this->referrer?->name),
            'has_resume' => $this->resume_path !== null,
            'resume_name' => $this->resume_name,
            'portal_token' => $this->portal_token,
            'portal_url' => $this->portalUrl(),
            'portal_visits' => $this->portal_visits,
            'portal_last_seen_at' => $this->portal_last_seen_at?->toIso8601String(),
            'application_count' => $this->applications_count ?? null,
            'added_at' => $this->created_at?->toIso8601String(),
            'is_active' => (bool) $this->is_active,
        ];
    }
}

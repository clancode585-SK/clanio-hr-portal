<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PolicyAcknowledgementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'policy_id' => (int) $this->policy_id,
            'policy_uuid' => $this->policy?->uuid,
            'title' => $this->policy?->title,
            'category' => $this->policy?->category,
            'version' => $this->policy?->version,
            'summary' => $this->policy?->summary,
            'has_file' => $this->policy?->file_path !== null,
            'download_url' => $this->policy?->file_path === null
                ? null
                : '/policies/' . $this->policy?->uuid . '/download',

            'status' => $this->status,
            'due_on' => $this->due_on?->format('Y-m-d'),
            'is_overdue' => $this->isOverdue(),
            'acknowledged_at' => $this->acknowledged_at,
            'note' => $this->note,
        ];
    }
}

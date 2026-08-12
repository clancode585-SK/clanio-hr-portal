<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Policy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PolicyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $canManage = (bool) $request->user()?->hasPermission(Policy::MANAGE_PERMISSION);

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'category' => $this->category,
            'category_label' => $this->categoryLabel(),
            'title' => $this->title,
            'version' => $this->version,
            'summary' => $this->summary,
            'body' => $this->when($request->routeIs('*policies.show'), fn () => $this->body),
            'has_file' => $this->file_path !== null,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'download_url' => $this->file_path === null ? null : '/policies/' . $this->uuid . '/download',

            'effective_from' => $this->effective_from?->format('Y-m-d'),
            'review_on' => $this->review_on?->format('Y-m-d'),
            'needs_ack' => $this->needs_ack,
            'ack_due_days' => $this->ack_due_days,

            'status' => $this->status,
            'published_at' => $this->published_at,
            'published_by_name' => $this->publisher?->name,
            'archived_at' => $this->archived_at,

            'acknowledgement_count' => $this->whenCounted('acknowledgements'),

            'can' => [
                'edit' => $canManage && $this->isDraft(),
                'publish' => $canManage && $this->isDraft(),
                'archive' => $canManage && $this->isPublished(),
                'delete' => $canManage && $this->isDraft(),
            ],

            'created_at' => $this->created_at,
        ];
    }
}

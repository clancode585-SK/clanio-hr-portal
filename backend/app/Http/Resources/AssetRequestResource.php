<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actor = $request->user();
        $isOwner = (int) $this->employee?->user_id === (int) $actor?->id;
        $canHandle = (bool) $actor?->hasPermission(Asset::SUPPORT_PERMISSION);

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'employee_code' => $this->employee?->employee_code,

            'request_type' => $this->request_type,
            'request_type_label' => $this->typeLabel(),
            'category' => $this->category,
            'asset_id' => $this->asset_id === null ? null : (int) $this->asset_id,
            'asset_code' => $this->asset?->asset_code,
            'asset_name' => $this->asset?->name,
            'asset_status' => $this->asset?->status,

            'title' => $this->title,
            'description' => $this->description,
            'priority' => $this->priority,
            'status' => $this->status,
            'stage' => $this->stageLabel(),
            'is_closed' => $this->isClosed(),

            'handler_id' => $this->handler_id === null ? null : (int) $this->handler_id,
            'handler_name' => $this->handler?->name,
            'decided_at' => $this->decided_at,
            'decision_remarks' => $this->decision_remarks,
            'started_at' => $this->started_at,
            'resolved_at' => $this->resolved_at,
            'resolution' => $this->resolution,

            'can' => [
                'edit' => $isOwner && $this->isPending(),
                'cancel' => $isOwner && $this->isPending(),
                'approve' => $canHandle && $this->isPending(),
                'reject' => $canHandle && ! $this->isClosed(),
                'start' => $canHandle && $this->isApproved(),
                'resolve' => $canHandle && ($this->isApproved() || $this->isInProgress()),
            ],

            'created_at' => $this->created_at,
        ];
    }
}

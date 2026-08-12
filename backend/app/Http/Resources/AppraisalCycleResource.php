<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\AppraisalCycle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AppraisalCycleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $canManage = (bool) $request->user()?->hasPermission(AppraisalCycle::MANAGE_PERMISSION);

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'period_start' => $this->period_start?->format('Y-m-d'),
            'period_end' => $this->period_end?->format('Y-m-d'),
            'self_review_due' => $this->self_review_due?->format('Y-m-d'),
            'manager_review_due' => $this->manager_review_due?->format('Y-m-d'),
            'rating_scale' => (int) $this->rating_scale,
            'status' => $this->status,
            'stage' => $this->stageLabel(),
            'launched_at' => $this->launched_at,
            'closed_at' => $this->closed_at,
            'appraisal_count' => $this->whenCounted('appraisals'),
            'can' => [
                'edit' => $this->isDraft() && $canManage,
                'launch' => $this->isDraft() && $canManage,
                'advance' => ! $this->isDraft() && ! $this->isClosed() && $canManage,
            ],
            'created_at' => $this->created_at,
        ];
    }
}

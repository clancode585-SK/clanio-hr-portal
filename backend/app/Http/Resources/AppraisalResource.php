<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\AppraisalCycle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AppraisalResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actor = $request->user();
        $isOwner = (int) $this->employee?->user_id === (int) $actor?->id;
        $isManager = (int) $this->manager_id === (int) $actor?->id;
        $stage = $this->cycle?->status;

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'appraisal_cycle_id' => (int) $this->appraisal_cycle_id,
            'cycle_name' => $this->cycle?->name,
            'rating_scale' => (int) ($this->cycle?->rating_scale ?? 5),
            'period_start' => $this->cycle?->period_start?->format('Y-m-d'),
            'period_end' => $this->cycle?->period_end?->format('Y-m-d'),

            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'employee_code' => $this->employee?->employee_code,
            'manager_id' => $this->manager_id === null ? null : (int) $this->manager_id,
            'manager_name' => $this->manager?->name,

            'status' => $this->status,
            'stage' => $this->stageLabel(),

            'auto_score' => $this->auto_score,
            'goal_achievement_percent' => $this->goal_achievement_percent,

            'self' => [
                'rating' => $this->self_rating,
                'comments' => $this->self_comments,
                'submitted_at' => $this->self_submitted_at,
            ],
            'manager_review' => [
                'rating' => $this->manager_rating,
                'comments' => $this->manager_comments,
                'submitted_at' => $this->manager_submitted_at,
            ],
            'final' => [
                'rating' => $this->final_rating,
                'comments' => $this->final_comments,
                'hr_name' => $this->hr?->name,
                'finalised_at' => $this->finalised_at,
            ],

            'can' => [
                'self_review' => $isOwner && $this->isPending() && $stage === AppraisalCycle::SELF_REVIEW,
                'manager_review' => $isManager && $this->isSelfDone() && $stage === AppraisalCycle::MANAGER_REVIEW,
                'finalise' => $this->isManagerDone()
                    && (bool) $actor?->hasPermission(AppraisalCycle::FINALISE_PERMISSION),
            ],

            'created_at' => $this->created_at,
        ];
    }
}

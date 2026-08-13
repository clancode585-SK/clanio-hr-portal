<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\AppraisalCycle;
use App\Models\PerformanceGoal;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PerformanceGoalResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actor = $request->user();
        $isOwner = (int) $this->employee?->user_id === (int) $actor?->id;
        $canApprove = ! $isOwner && (
            (bool) $actor?->hasPermission(AppraisalCycle::MANAGE_PERMISSION)
            || (int) $this->employee?->reporting_manager_id === (int) $actor?->id
        );

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'appraisal_cycle_id' => $this->appraisal_cycle_id === null ? null : (int) $this->appraisal_cycle_id,
            'parent_id' => $this->parent_id === null ? null : (int) $this->parent_id,

            'goal_type' => $this->goal_type,
            'title' => $this->title,
            'description' => $this->description,
            'metric' => $this->metric,
            'target_value' => $this->target_value,
            'achieved_value' => $this->achieved_value,
            'weight' => (int) $this->weight,

            'start_date' => $this->start_date?->format('Y-m-d'),
            'due_date' => $this->due_date?->format('Y-m-d'),

            'period_type' => $this->period_type,
            'period_label' => $this->period_label,

            'progress_source' => $this->progress_source,
            'progress_percent' => (int) $this->progress_percent,
            'status' => $this->status,
            'is_closed' => $this->isClosed(),

            'verification_status' => $this->verification_status,
            'verification_stage' => $this->verificationLabel(),
            'achievement_percent' => $this->achievement_percent,
            'submitted' => [
                'value' => $this->submitted_value,
                'at' => $this->submitted_at,
            ],
            'manager_check' => [
                'value' => $this->manager_value,
                'at' => $this->manager_verified_at,
                'remarks' => $this->manager_remarks,
            ],
            'final_check' => [
                'value' => $this->final_value,
                'at' => $this->hr_verified_at,
                'remarks' => $this->hr_remarks,
            ],

            'approved_by' => $this->approved_by === null ? null : (int) $this->approved_by,
            'approver_name' => $this->approver?->name,
            'approved_at' => $this->approved_at,
            'closed_at' => $this->closed_at,
            'closing_remarks' => $this->closing_remarks,

            'key_results' => PerformanceGoalResource::collection($this->whenLoaded('keyResults')),
            'key_result_count' => $this->whenCounted('keyResults'),
            'linked_tasks' => $this->whenLoaded('tasks', fn (): array => $this->tasks
                ->map(fn ($task): array => [
                    'task_id' => (int) $task->id,
                    'title' => $task->title,
                    'status' => $task->status,
                ])->all()),

            'can' => [
                'edit' => ! $this->isClosed() && ($isOwner || $canApprove),
                'approve' => $this->status === PerformanceGoal::DRAFT && $canApprove,
                'update_progress' => $this->isActive()
                    && ! $this->isObjective()
                    && ! $this->tracksTasks()
                    && ($isOwner || $canApprove),
                'close' => $this->isActive() && $canApprove,
                'submit' => $isOwner && $this->isActive() && ! $this->isFinalised()
                    && $this->verification_status !== PerformanceGoal::SUBMITTED,
                'verify' => $this->isSubmitted() && $canApprove,
                'finalise' => $this->isManagerVerified()
                    && (bool) $actor?->hasPermission(PerformanceGoal::VERIFY_PERMISSION),
            ],

            'created_at' => $this->created_at,
        ];
    }
}

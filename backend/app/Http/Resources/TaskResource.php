<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->priority,
            'due_date' => $this->due_date,
            'days_left' => $this->daysLeft(),
            'is_overdue' => $this->isOverdue(),
            'is_closed' => $this->isClosed(),
            'estimated_hours' => $this->estimated_hours,
            'spent_hours' => $this->spent_hours,
            'blocked_reason' => $this->blocked_reason,
            'assignee' => [
                'id' => (int) $this->assignee_id,
                'name' => $this->assignee?->name,
                'email' => $this->assignee?->email,
                'avatar_url' => $this->assignee?->avatarUrl(),
            ],
            'assigned_by' => $this->assigned_by === null ? null : [
                'id' => (int) $this->assigned_by,
                'name' => $this->assigner?->name,
            ],
            'parent_id' => $this->parent_id === null ? null : (int) $this->parent_id,
            'parent_title' => $this->parent?->title,
            'is_subtask' => $this->isSubtask(),
            'subtask_count' => $this->whenCounted('subtasks'),
            'subtasks' => TaskResource::collection($this->whenLoaded('subtasks')),
            'comment_count' => $this->whenCounted('comments'),
            'comments' => TaskCommentResource::collection($this->whenLoaded('comments')),
            'attachment_count' => $this->whenCounted('attachments'),
            'attachments' => TaskAttachmentResource::collection($this->whenLoaded('attachments')),
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actor = $request->user();

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'ticket_no' => $this->ticket_no,
            'scope' => $this->scope,
            'subject' => $this->subject,
            'message' => $this->message,
            'priority' => $this->priority,
            'status' => $this->status,
            'stage_label' => $this->stageLabel(),
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category?->id,
                'name' => $this->category?->name,
                'code' => $this->category?->code,
            ]),
            'route' => $this->whenLoaded('route', fn () => [
                'id' => $this->route?->id,
                'label' => $this->route?->label,
                'route_to' => $this->route_to,
            ]),
            'raised_by' => $this->raised_by,
            'raiser' => $this->whenLoaded('raiser', fn () => [
                'id' => $this->raiser?->id,
                'name' => $this->raiser?->name,
            ]),
            'assigned_to' => $this->assigned_to,
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee === null ? null : [
                'id' => $this->assignee->id,
                'name' => $this->assignee->name,
            ]),
            'assigned_department_id' => $this->assigned_department_id,
            'department' => $this->whenLoaded('department', fn () => $this->department === null ? null : [
                'id' => $this->department->id,
                'name' => $this->department->name,
            ]),
            'sla' => [
                'has_target' => $this->hasTarget(),
                'first_response_due_at' => $this->first_response_due_at?->toIso8601String(),
                'resolution_due_at' => $this->resolution_due_at?->toIso8601String(),
                'first_responded_at' => $this->first_responded_at?->toIso8601String(),
                'minutes_left' => $this->minutesLeft(),
                'state' => $this->slaState(),
                'paused_minutes' => $this->paused_minutes,
                'response_breached' => (bool) $this->response_breached,
                'resolution_breached' => (bool) $this->resolution_breached,
            ],
            'resolution_note' => $this->resolution_note,
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolver' => $this->whenLoaded('resolver', fn () => $this->resolver === null ? null : [
                'id' => $this->resolver->id,
                'name' => $this->resolver->name,
            ]),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'reopened_at' => $this->reopened_at?->toIso8601String(),
            'reopen_count' => $this->reopen_count,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'can_reopen' => $this->canReopen(),
            'is_raiser' => $actor !== null && $this->isRaiser($actor),
            'comments_count' => $this->whenCounted('comments'),
            'comments' => TicketCommentResource::collection($this->whenLoaded('comments')),
            'attachments' => TicketAttachmentResource::collection($this->whenLoaded('attachments')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    public static function statuses(): array
    {
        return Ticket::STATUSES;
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'type' => $this->type,
            'group' => $this->group_name,
            'priority' => $this->priority,
            'title' => $this->title,
            'body' => $this->body,
            'action_url' => $this->action_url,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id === null ? null : (int) $this->entity_id,
            'payload' => $this->payload ?? [],
            'actor_id' => $this->actor_id === null ? null : (int) $this->actor_id,
            'is_read' => $this->read_at !== null,
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
        ];
    }
}

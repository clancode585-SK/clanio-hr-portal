<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskCommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'task_id' => (int) $this->task_id,
            'body' => $this->body,
            'author' => [
                'id' => (int) $this->user_id,
                'name' => $this->author?->name,
                'avatar_url' => $this->author?->avatarUrl(),
            ],
            'is_mine' => (int) $this->user_id === (int) $request->user()?->id,
            'created_at' => $this->created_at,
        ];
    }
}

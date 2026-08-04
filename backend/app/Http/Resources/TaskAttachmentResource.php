<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskAttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'task_id' => (int) $this->task_id,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'size' => $this->humanSize(),
            'download_url' => route('task-attachments.download', ['attachment' => $this->uuid]),
            'uploaded_by' => [
                'id' => $this->uploaded_by === null ? null : (int) $this->uploaded_by,
                'name' => $this->uploader?->name,
            ],
            'is_mine' => (int) $this->uploaded_by === (int) $request->user()?->id,
            'created_at' => $this->created_at,
        ];
    }
}

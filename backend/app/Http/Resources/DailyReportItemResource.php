<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DailyReportItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'section' => $this->section,
            'title' => $this->title,
            'hours' => $this->hours,
            'is_completed' => $this->is_completed,
            'sort_order' => $this->sort_order,
            'task' => $this->task_id === null ? null : [
                'id' => (int) $this->task_id,
                'uuid' => $this->task?->uuid,
                'title' => $this->task?->title,
                'status' => $this->task?->status,
                'priority' => $this->task?->priority,
            ],
        ];
    }
}

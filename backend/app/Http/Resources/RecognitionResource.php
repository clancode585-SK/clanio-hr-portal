<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecognitionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actor = $request->user();

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'type' => $this->type,
            'type_label' => $this->typeLabel(),
            'title' => $this->title,
            'message' => $this->message,
            'points' => $this->points,
            'visibility' => $this->visibility,
            'is_auto' => $this->is_auto,
            'awarded_on' => $this->awarded_on?->format('Y-m-d'),
            'given_by' => $this->given_by === null ? null : (int) $this->given_by,
            'given_by_name' => $this->giver?->name,
            'goal_id' => $this->performance_goal_id === null ? null : (int) $this->performance_goal_id,
            'can_delete' => (int) $this->given_by === (int) $actor?->id || (bool) $actor?->isSuperAdmin(),
            'created_at' => $this->created_at,
        ];
    }
}

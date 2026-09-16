<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $changes = $this->changeList();

        return [
            'id' => $this->id,
            'event' => $this->event,
            'entity' => $this->auditable_type,
            'entity_label' => $this->entityLabel(),
            'entity_id' => $this->auditable_id,
            'actor_id' => $this->user_id,
            'actor' => $this->user?->name,
            'actor_email' => $this->user?->email,
            'ip_address' => $this->ip_address,
            'happened_at' => $this->created_at?->toIso8601String(),
            'change_count' => count($changes),
            'changes' => $changes,
        ];
    }

    private function entityLabel(): string
    {
        return trim((string) preg_replace('/(?<!^)[A-Z]/', ' $0', (string) $this->auditable_type));
    }
}

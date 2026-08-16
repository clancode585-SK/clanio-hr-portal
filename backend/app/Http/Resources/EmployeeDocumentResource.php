<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeDocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_id' => $this->employee_id,
            'type' => $this->type,
            'type_label' => $this->label(),
            'title' => $this->title,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'size_human' => $this->sizeHuman(),
            'document_number' => $this->document_number,
            'issued_on' => $this->issued_on?->format('Y-m-d'),
            'expires_on' => $this->expires_on?->format('Y-m-d'),
            'is_expired' => $this->isExpired(),
            'status' => $this->status,
            'remarks' => $this->remarks,
            'verified_at' => $this->verified_at,
            'verifier' => new UserResource($this->whenLoaded('verifier')),
            'download_url' => route('documents.download', ['document' => $this->uuid]),
            'created_at' => $this->created_at,
        ];
    }

    private function sizeHuman(): string
    {
        $bytes = (int) $this->size_bytes;

        return $bytes >= 1048576
            ? round($bytes / 1048576, 2) . ' MB'
            : round($bytes / 1024, 1) . ' KB';
    }
}

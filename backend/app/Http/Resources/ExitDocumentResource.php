<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExitDocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_exit_id' => (int) $this->employee_exit_id,
            'type' => $this->type,
            'type_label' => $this->typeLabel(),
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'issued_on' => $this->issued_on?->format('Y-m-d'),
            'remarks' => $this->remarks,
            'uploaded_by' => $this->uploaded_by === null ? null : (int) $this->uploaded_by,
            'uploader_name' => $this->uploader?->name,
            'download_url' => '/exit-documents/' . $this->uuid . '/download',
            'created_at' => $this->created_at,
        ];
    }
}

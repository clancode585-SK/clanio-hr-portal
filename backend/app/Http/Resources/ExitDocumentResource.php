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
            'source' => $this->source,
            'is_generated' => $this->source === 'generated',
            'letter_number' => $this->letter_number,
            'body' => $this->body,
            'signatory_name' => $this->signatory_name,
            'signatory_designation' => $this->signatory_designation,
            'uploaded_by' => $this->uploaded_by === null ? null : (int) $this->uploaded_by,
            'uploader_name' => $this->uploader?->name,
            'preview_url' => $this->source === 'generated'
                ? '/exit-documents/' . $this->uuid . '/preview'
                : null,
            'download_url' => '/exit-documents/' . $this->uuid . '/download',
            'created_at' => $this->created_at,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseBillResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'expense_claim_id' => (int) $this->expense_claim_id,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'download_url' => route('expense-bills.download', ['bill' => $this->uuid]),
            'uploaded_by' => $this->uploaded_by === null ? null : (int) $this->uploaded_by,
            'uploader_name' => $this->uploader?->name,
            'created_at' => $this->created_at,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HolidayResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'branch_id' => $this->branch_id,
            'name' => $this->name,
            'holiday_date' => $this->holiday_date?->format('Y-m-d'),
            'day' => $this->holiday_date?->format('l'),
            'type' => $this->type,
            'is_paid' => $this->is_paid,
            'blocks_attendance' => $this->blocksAttendance(),
            'description' => $this->description,
            'branch' => new BranchResource($this->whenLoaded('branch')),
            'created_at' => $this->created_at,
        ];
    }
}

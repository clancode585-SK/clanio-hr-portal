<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DailyReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'employee_code' => $this->employee?->employee_code,
            'report_date' => $this->report_date,
            'status' => $this->status,
            'sod' => [
                'plan' => $this->sod_plan,
                'submitted_at' => $this->sod_submitted_at,
                'is_late' => $this->is_sod_late,
                'items' => DailyReportItemResource::collection($this->whenLoaded('sodItems')),
            ],
            'eod' => [
                'summary' => $this->eod_summary,
                'blockers' => $this->eod_blockers,
                'tomorrow_plan' => $this->eod_tomorrow_plan,
                'worked_hours' => $this->worked_hours,
                'submitted_at' => $this->eod_submitted_at,
                'is_late' => $this->is_eod_late,
                'items' => DailyReportItemResource::collection($this->whenLoaded('eodItems')),
            ],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\SalaryStructureLine;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalaryStructureResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_id' => (int) $this->employee_id,
            'employee_code' => $this->employee?->employee_code,
            'employee_name' => $this->employee?->user?->name,

            'effective_from' => $this->effective_from?->format('Y-m-d'),
            'effective_to' => $this->effective_to?->format('Y-m-d'),
            'is_current' => $this->isCurrent(),
            'status' => $this->status,
            'revision_reason' => $this->revision_reason,

            'annual_ctc' => $this->annual_ctc,
            'annual_ctc_words' => Money::indian($this->annual_ctc),
            'monthly_gross' => $this->monthly_gross,
            'monthly_net' => $this->monthly_net,
            'monthly_deductions' => round((float) $this->monthly_gross - (float) $this->monthly_net, 2),
            'monthly_employer_cost' => $this->whenLoaded('lines', fn (): float => $this->employerCost()),

            'lines' => $this->whenLoaded('lines', fn (): array => $this->lines
                ->map(fn (SalaryStructureLine $line): array => [
                    'component_id' => (int) $line->component_id,
                    'code' => $line->code,
                    'name' => $line->name,
                    'kind' => $line->kind,
                    'calculation' => $line->calculation,
                    'value' => $line->value,
                    'monthly_amount' => $line->monthly_amount,
                    'annual_amount' => $line->annual_amount,
                    'is_taxable' => $line->is_taxable,
                    'is_statutory' => $line->is_statutory,
                ])
                ->all()),

            'created_at' => $this->created_at,
        ];
    }
}

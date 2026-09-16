<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'month' => $this->month,
            'month_label' => $this->monthLabel(),
            'pay_date' => $this->pay_date?->format('Y-m-d'),
            'status' => $this->status,
            'status_label' => $this->statusLabel(),

            'headcount' => $this->headcount,
            'working_days' => $this->working_days,

            'total_earnings' => $this->total_earnings,
            'total_deductions' => $this->total_deductions,
            'total_net' => $this->total_net,
            'total_net_words' => Money::indian($this->total_net),
            'total_employer' => $this->total_employer,
            'cost_to_company' => round((float) $this->total_earnings + (float) $this->total_employer, 2),

            'paid_count' => $this->paid_count,
            'paid_amount' => $this->paid_amount,
            'pending_count' => max($this->headcount - $this->paid_count, 0),
            'pending_amount' => round((float) $this->total_net - (float) $this->paid_amount, 2),

            'is_editable' => $this->isEditable(),
            'is_payable' => $this->isPayable(),
            'note' => $this->note,

            'calculated_at' => $this->calculated_at,
            'calculated_by' => $this->whenLoaded('calculatedBy', fn () => $this->calculatedBy?->name),
            'approved_at' => $this->approved_at,
            'approved_by' => $this->whenLoaded('approvedBy', fn () => $this->approvedBy?->name),

            'items' => PayrollItemResource::collection($this->whenLoaded('items')),

            'created_at' => $this->created_at,
        ];
    }
}

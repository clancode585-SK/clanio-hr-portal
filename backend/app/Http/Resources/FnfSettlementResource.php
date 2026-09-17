<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\FnfLine;
use App\Models\FnfSettlement;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FnfSettlementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'exit_uuid' => $this->whenLoaded('exit', fn (): ?string => $this->exit?->uuid),
            'employee_id' => (int) $this->employee_id,
            'employee_code' => $this->employee_code,
            'employee_name' => $this->employee_name,
            'designation' => $this->designation,
            'pan_number' => $this->pan_number,
            'uan_number' => $this->uan_number,

            'date_of_joining' => $this->date_of_joining?->format('Y-m-d'),
            'last_working_date' => $this->last_working_date?->format('Y-m-d'),
            'service_years' => $this->service_years,

            'monthly_gross' => $this->monthly_gross,
            'monthly_basic' => $this->monthly_basic,
            'working_days' => $this->working_days,
            'paid_days' => $this->paid_days,

            'notice_required_days' => $this->notice_required_days,
            'notice_served_days' => $this->notice_served_days,
            'notice_shortfall_days' => $this->notice_shortfall_days,

            'total_earnings' => $this->total_earnings,
            'total_deductions' => $this->total_deductions,
            'net_payable' => $this->net_payable,
            'net_payable_words' => Money::inWords(abs((float) $this->net_payable)),
            'recoverable' => $this->recoverable,
            'owes_company' => $this->owesCompany(),

            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            'payment_status' => $this->payment_status,
            'payment_label' => $this->paymentLabel(),
            'is_editable' => $this->isEditable(),
            'is_transferable' => $this->isTransferable(),
            'is_stopped' => $this->payment_status === FnfSettlement::ON_HOLD,
            'hold_reason' => $this->hold_reason,

            'note' => $this->note,
            'calculated_at' => $this->calculated_at?->toIso8601String(),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'approved_by' => $this->whenLoaded('approvedBy', fn (): ?string => $this->approvedBy?->name),
            'settled_at' => $this->settled_at?->toIso8601String(),

            'lines' => $this->whenLoaded('lines', fn (): array => $this->lines
                ->map(fn (FnfLine $line): array => [
                    'uuid' => $line->uuid,
                    'code' => $line->code,
                    'name' => $line->name,
                    'kind' => $line->kind,
                    'source' => $line->source,
                    'is_suggestion' => $line->isSuggestion(),
                    'is_applied' => $line->is_applied,
                    'amount' => $line->amount,
                    'suggested_amount' => $line->suggested_amount,
                    'basis' => $line->basis,
                    'note' => $line->note,
                ])
                ->all()),

            'suggestions_pending' => $this->whenLoaded('lines', fn (): int => $this->lines
                ->filter(fn (FnfLine $line): bool => $line->isSuggestion() && ! $line->is_applied)
                ->count()),
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PayrollItemLine;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'run_id' => (int) $this->run_id,
            'employee_id' => (int) $this->employee_id,
            'employee_code' => $this->employee_code,
            'employee_name' => $this->employee_name,
            'designation' => $this->designation,
            'pan_number' => $this->pan_number,
            'uan_number' => $this->uan_number,

            'month' => $this->whenLoaded('run', fn (): ?string => $this->run?->month),
            'month_label' => $this->whenLoaded('run', fn (): ?string => $this->run?->monthLabel()),
            'pay_date' => $this->whenLoaded('run', fn (): ?string => $this->run?->pay_date?->format('Y-m-d')),
            'run_status' => $this->whenLoaded('run', fn (): ?string => $this->run?->status),

            'annual_ctc' => $this->annual_ctc,
            'working_days' => $this->working_days,
            'lop_days' => $this->lop_days,
            'paid_days' => $this->paid_days,
            'lop_suggested' => $this->lop_suggested,
            'lop_locked_by_hr' => $this->lop_locked_by_hr,
            'lop_differs_from_attendance' => (float) $this->lop_days !== (float) $this->lop_suggested,

            'gross_earnings' => $this->gross_earnings,
            'total_deductions' => $this->total_deductions,
            'employer_cost' => $this->employer_cost,
            'net_payable' => $this->net_payable,
            'net_payable_words' => Money::indian($this->net_payable),

            'payment_status' => $this->payment_status,
            'payment_label' => $this->paymentLabel(),
            'is_transferable' => $this->isTransferable(),
            'hold_reason' => $this->hold_reason,
            'note' => $this->note,

            'approval_status' => $this->approval_status,
            'approval_label' => $this->approvalLabel(),
            'is_approved' => $this->isApproved(),
            'is_stopped' => $this->isOnHold(),
            'approved_at' => $this->approved_at?->toIso8601String(),

            'lines' => $this->whenLoaded('lines', fn (): array => $this->lines
                ->map(fn (PayrollItemLine $line): array => [
                    'code' => $line->code,
                    'name' => $line->name,
                    'kind' => $line->kind,
                    'full_amount' => $line->full_amount,
                    'amount' => $line->amount,
                    'is_statutory' => $line->is_statutory,
                    'was_cut' => (float) $line->amount !== (float) $line->full_amount,
                ])
                ->all()),
        ];
    }
}

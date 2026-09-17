<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\SalaryAdvance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SalaryAdvance */
class SalaryAdvanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'uuid' => $this->uuid,
            'reference' => $this->reference,
            'employee_code' => $this->employee_code,
            'employee_name' => $this->employee_name,
            'amount' => (float) $this->amount,
            'emi_amount' => (float) $this->emi_amount,
            'tenure_months' => (int) $this->tenure_months,
            'recovered' => (float) $this->recovered,
            'outstanding' => (float) $this->outstanding,
            'instalments_left' => $this->instalmentsLeft(),
            'reason' => $this->reason,
            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            'payment_status' => $this->payment_status,
            'hold_reason' => $this->hold_reason,
            'start_period' => $this->start_period,
            'decision_note' => $this->decision_note,
            'decided_by' => $this->whenLoaded('decidedBy', fn () => $this->decidedBy?->name),
            'requested_at' => $this->requested_at?->toIso8601String(),
            'decided_at' => $this->decided_at?->toIso8601String(),
            'disbursed_at' => $this->disbursed_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'recoveries' => $this->whenLoaded('recoveries', fn () => $this->recoveries->map(fn ($row): array => [
                'period' => $row->period,
                'amount' => (float) $row->amount,
                'source' => $row->source,
            ])->all()),
            'can' => [
                'decide' => $this->isPending() && $user?->hasPermission(SalaryAdvance::APPROVE_PERMISSION),
                'transfer' => $this->isTransferable() && $user?->hasPermission(SalaryAdvance::MANAGE_PERMISSION),
                'edit_plan' => ! in_array($this->status, [SalaryAdvance::REJECTED, SalaryAdvance::CLOSED, SalaryAdvance::CANCELLED], true)
                    && $user?->hasPermission(SalaryAdvance::MANAGE_PERMISSION),
                'cancel' => in_array($this->status, [SalaryAdvance::PENDING, SalaryAdvance::APPROVED], true)
                    && $user?->hasPermission(SalaryAdvance::MANAGE_PERMISSION),
            ],
        ];
    }
}

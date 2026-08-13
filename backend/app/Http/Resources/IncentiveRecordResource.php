<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\IncentiveRule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncentiveRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $canApprove = (bool) $request->user()?->hasPermission(IncentiveRule::APPROVE_PERMISSION);

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_id' => (int) $this->employee_id,
            'employee_name' => $this->employee?->user?->name,
            'employee_code' => $this->employee?->employee_code,

            'period_type' => $this->period_type,
            'period_label' => $this->period_label,
            'period_start' => $this->period_start?->format('Y-m-d'),
            'period_end' => $this->period_end?->format('Y-m-d'),

            'goal_count' => $this->goal_count,
            'achievement_percent' => $this->achievement_percent,
            'base_percent' => $this->base_percent,
            'payout_factor' => $this->payout_factor,
            'incentive_percent' => $this->incentive_percent,
            'slab_label' => $this->slab_label,

            'rule_name' => $this->rule?->name,
            'status' => $this->status,
            'calculated_at' => $this->calculated_at,
            'approved_by_name' => $this->approver?->name,
            'approved_at' => $this->approved_at,
            'remarks' => $this->remarks,

            'can' => [
                'approve' => $canApprove && $this->isCalculated(),
                'reject' => $canApprove && $this->isCalculated(),
            ],

            'created_at' => $this->created_at,
        ];
    }
}

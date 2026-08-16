<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'is_paid' => $this->is_paid,
            'annual_quota' => $this->annual_quota,
            'accrual_type' => $this->accrual_type,
            'monthly_accrual' => $this->accruesMonthly() ? $this->monthlyAccrual() : null,
            'allow_half_day' => $this->allow_half_day,
            'min_notice_days' => $this->min_notice_days,
            'max_consecutive_days' => $this->max_consecutive_days,
            'carry_forward' => $this->carry_forward,
            'carry_forward_max' => $this->carry_forward_max,
            'is_encashable' => $this->is_encashable,
            'encashment_max' => $this->encashment_max,
            'applicable_to' => $this->applicable_to,
            'min_service_months' => $this->min_service_months,
            'count_weekly_off' => $this->count_weekly_off,
            'count_holiday' => $this->count_holiday,
            'requires_document' => $this->requires_document,
            'tracks_balance' => $this->tracksBalance(),
            'sort_order' => $this->sort_order,
            'status' => $this->status,
            'created_at' => $this->created_at,
        ];
    }
}

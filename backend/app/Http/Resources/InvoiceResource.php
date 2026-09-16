<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'invoice_number' => $this->invoice_number,
            'company_id' => $this->company_id,
            'company' => $this->whenLoaded('company', fn (): array => [
                'id' => $this->company->id,
                'uuid' => $this->company->uuid,
                'name' => $this->company->name,
                'slug' => $this->company->slug,
            ]),
            'plan_id' => $this->plan_id,
            'plan_name' => $this->plan_name,
            'plan_code' => $this->plan_code,
            'seats' => $this->seats,
            'price_per_seat' => $this->price_per_seat,
            'currency' => $this->currency,
            'billing_cycle' => $this->billing_cycle,
            'subtotal' => $this->subtotal,
            'gst_percent' => $this->gst_percent,
            'gst_amount' => $this->gst_amount,
            'total' => $this->total,
            'status' => $this->status,
            'period_start' => $this->period_start?->toDateString(),
            'period_end' => $this->period_end?->toDateString(),
            'issued_at' => $this->issued_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'payment_method' => $this->payment_method,
            'payment_reference' => $this->payment_reference,
            'billed_to_name' => $this->billed_to_name,
            'billed_to_email' => $this->billed_to_email,
            'billed_to_gstin' => $this->billed_to_gstin,
            'billed_to_address' => $this->billed_to_address,
            'notes' => $this->notes,
        ];
    }
}

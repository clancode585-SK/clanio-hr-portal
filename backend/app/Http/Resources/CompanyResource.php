<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompanyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'legal_name' => $this->legal_name,
            'slug' => $this->slug,
            'email' => $this->email,
            'phone' => $this->phone,
            'website' => $this->website,
            'address' => $this->address,
            'city' => $this->city,
            'state' => $this->state,
            'country' => $this->country,
            'pincode' => $this->pincode,
            'gstin' => $this->gstin,
            'pan_number' => $this->pan_number,
            'tan_number' => $this->tan_number,
            'cin_number' => $this->cin_number,
            'industry' => $this->industry,
            'employee_count' => $this->employee_count,
            'max_employees' => $this->max_employees,
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'fiscal_year_start' => $this->fiscal_year_start,
            'status' => $this->status,
            'created_at' => $this->created_at,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Plan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $planId = $creating ? null : $this->route('plan')->id;

        return [
            'name' => [$required, 'string', 'max:60'],
            'code' => [$required, 'string', 'alpha_dash', 'max:30',
                Rule::unique('plans', 'code')->where('is_active', 1)->ignore($planId)],
            'tagline' => ['nullable', 'string', 'max:150'],
            'price_per_seat' => [$required, 'numeric', 'min:0', 'max:99999'],
            'currency' => ['nullable', 'string', 'size:3'],
            'billing_cycle' => ['nullable', Rule::in(Plan::CYCLES)],
            'min_seats' => ['nullable', 'integer', 'between:1,10000'],
            'max_seats' => ['nullable', 'integer', 'between:1,10000', 'gte:min_seats'],
            'trial_days' => ['nullable', 'integer', 'between:0,90'],
            'gst_percent' => ['nullable', 'numeric', 'between:0,50'],
            'highlights' => ['nullable', 'string', 'max:500'],
            'is_popular' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'between:0,999'],
        ];
    }

    public function messages(): array
    {
        return [
            'max_seats.gte' => 'The seat ceiling cannot be lower than the seat floor.',
        ];
    }
}

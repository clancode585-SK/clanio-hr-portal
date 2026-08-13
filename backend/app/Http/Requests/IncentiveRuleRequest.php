<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\PerformanceGoal;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IncentiveRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $companyId = app(TenantContext::class)->id();

        return [
            'name' => [$required, 'string', 'max:100'],
            'role_id' => ['nullable', 'integer',
                Rule::exists('roles', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'base_percent' => [$required, 'numeric', 'between:0,100'],
            'period_type' => ['nullable', Rule::in(PerformanceGoal::PERIOD_TYPES)],
            'description' => ['nullable', 'string', 'max:500'],

            'slabs' => ['nullable', 'array', 'min:1'],
            'slabs.*.from_percent' => ['required_with:slabs', 'integer', 'between:0,999'],
            'slabs.*.to_percent' => ['required_with:slabs', 'integer', 'between:0,999'],
            'slabs.*.payout_factor' => ['required_with:slabs', 'integer', 'between:0,500'],
            'slabs.*.label' => ['nullable', 'string', 'max:60'],
        ];
    }

    public function messages(): array
    {
        return [
            'base_percent.required' => 'Base incentive % dena zaroori hai — jaise 10.',
            'base_percent.between' => 'Base incentive 0 se 100 ke beech rakho.',
        ];
    }
}

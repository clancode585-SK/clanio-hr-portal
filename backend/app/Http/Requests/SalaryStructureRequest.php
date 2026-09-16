<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalaryStructureRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();

        return [
            'effective_from' => ['required', 'date'],
            'annual_ctc' => ['required', 'numeric', 'min:1', 'max:999999999'],
            'revision_reason' => ['nullable', 'string', 'max:255'],

            'lines' => ['nullable', 'array', 'min:1'],
            'lines.*.component_id' => ['required_with:lines', 'integer',
                Rule::exists('salary_components', 'id')
                    ->where('company_id', $companyId)
                    ->where('is_active', 1)],
            'lines.*.value' => ['nullable', 'numeric', 'min:0', 'max:99999999'],

            'has_pf_account' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'annual_ctc.required' => 'Annual CTC dena zaroori hai.',
            'effective_from.required' => 'Ye structure kis date se lagega, wo batao.',
            'lines.*.component_id.exists' => 'Is company me ye component nahi hai.',
        ];
    }
}

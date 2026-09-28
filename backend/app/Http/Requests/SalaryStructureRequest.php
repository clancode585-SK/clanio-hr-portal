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
            'annual_ctc.required' => 'The annual CTC is required.',
            'effective_from.required' => 'Say which date this structure takes effect from.',
            'lines.*.component_id.exists' => 'This company does not have that component.',
        ];
    }
}

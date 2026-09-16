<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\SalaryComponent;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SalaryComponentRequest extends FormRequest
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
        $componentId = $creating ? null : $this->route('salaryComponent')?->id;

        return [
            'code' => [$required, 'string', 'alpha_dash', 'max:30',
                Rule::unique('salary_components', 'code')
                    ->where('company_id', $companyId)
                    ->where('is_active', 1)
                    ->ignore($componentId)],
            'name' => [$required, 'string', 'max:100'],
            'kind' => [$required, Rule::in(SalaryComponent::KINDS)],
            'calculation' => [$required, Rule::in(SalaryComponent::CALCULATIONS)],
            'default_value' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'is_taxable' => ['nullable', 'boolean'],
            'is_statutory' => ['nullable', 'boolean'],
            'affects_net' => ['nullable', 'boolean'],
            'sequence' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'Is code ka component already bana hua hai.',
            'code.alpha_dash' => 'Code me sirf letter, number, dash aur underscore chalega.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => Str::upper(trim((string) $this->input('code')))]);
        }
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class CompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $companyId = $creating ? null : $this->route('company')->id;
        $required = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:200'],
            'legal_name' => ['nullable', 'string', 'max:200'],
            'slug' => [$required, 'string', 'alpha_dash', 'min:3', 'max:100', Rule::unique('companies', 'slug')->ignore($companyId)],
            'email' => [$required, 'email', 'max:255', Rule::unique('companies', 'email')->ignore($companyId)],
            'phone' => ['nullable', 'string', 'max:20'],
            'website' => ['nullable', 'url', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'string', 'max:10'],
            'gstin' => ['nullable', 'string', 'size:15'],
            'pan_number' => ['nullable', 'string', 'size:10'],
            'tan_number' => ['nullable', 'string', 'size:10'],
            'cin_number' => ['nullable', 'string', 'max:21'],
            'industry' => ['nullable', 'string', 'max:100'],
            'max_employees' => ['nullable', 'integer', 'min:1'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'currency' => ['nullable', 'string', 'size:3'],
            'fiscal_year_start' => ['nullable', 'integer', 'between:1,12'],
            'sod_cutoff' => ['nullable', 'date_format:H:i'],
            'eod_cutoff' => ['nullable', 'date_format:H:i'],
            'regularization_days' => ['nullable', 'integer', 'between:0,90'],
            'status' => ['nullable', Rule::in(['active', 'suspended', 'archived'])],

            'admin' => [$creating ? 'required' : 'prohibited', 'array'],
            'admin.name' => [$required, 'string', 'max:150'],
            'admin.email' => [$required, 'email', 'max:255'],
            'admin.phone' => ['nullable', 'string', 'max:20'],
            'admin.password' => [$required, 'string', Password::min(8)->letters()->numbers()],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('slug')) {
            $this->merge(['slug' => Str::slug((string) $this->input('slug'))]);
        }

        if ($this->has('email')) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }
    }
}

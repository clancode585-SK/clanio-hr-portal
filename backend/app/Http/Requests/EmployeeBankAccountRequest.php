<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class EmployeeBankAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'account_holder_name' => [$required, 'string', 'max:150'],
            'bank_name' => [$required, 'string', 'max:150'],
            'account_number' => [$required, 'string', 'regex:/^[0-9]{9,18}$/'],
            'ifsc_code' => [$required, 'string', 'regex:/^[A-Z]{4}0[A-Z0-9]{6}$/'],
            'branch_name' => ['nullable', 'string', 'max:150'],
            'account_type' => ['nullable', Rule::in(['savings', 'current'])],
            'is_primary' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'account_number.regex' => 'The account number must be 9 to 18 digits.',
            'ifsc_code.regex' => 'The IFSC code must look like HDFC0001234.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('ifsc_code')) {
            $this->merge(['ifsc_code' => Str::upper(trim((string) $this->input('ifsc_code')))]);
        }

        if ($this->has('account_number')) {
            $this->merge(['account_number' => trim((string) $this->input('account_number'))]);
        }
    }
}

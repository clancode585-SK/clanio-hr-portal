<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\EmployeeExit;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();

        return [
            'employee_id' => ['nullable', 'integer',
                Rule::exists('employees', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'exit_type' => ['nullable', Rule::in(array_keys(EmployeeExit::EXIT_TYPES))],
            'resignation_date' => ['nullable', 'date'],
            'requested_last_working_date' => ['nullable', 'date', 'after_or_equal:resignation_date'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Resignation ki wajah likhni zaroori hai.',
            'requested_last_working_date.after_or_equal' => 'Last working date resignation date se pehle nahi ho sakti.',
        ];
    }
}

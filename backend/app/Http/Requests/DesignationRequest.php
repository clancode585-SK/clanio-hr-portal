<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DesignationRequest extends FormRequest
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
            'name' => [$required, 'string', 'max:150'],
            'department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('company_id', $companyId)->where('is_active', 1)],
        ];
    }
}

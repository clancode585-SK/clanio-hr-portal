<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
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
        $designationId = $creating ? null : $this->route('designation')->id;
        $companyId = app(TenantContext::class)->id();

        return [
            'name' => [$required, 'string', 'max:150'],
            'code' => [$required, 'string', 'alpha_dash', 'max:30',
                Rule::unique('designations', 'code')->where('company_id', $companyId)->whereNull('deleted_at')->ignore($designationId)],
            'level' => ['nullable', 'integer', 'between:1,20'],
            'description' => ['nullable', 'string', 'max:500'],
            'department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => Str::upper((string) $this->input('code'))]);
        }
    }
}

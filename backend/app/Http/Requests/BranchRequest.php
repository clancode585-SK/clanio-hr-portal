<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $branchId = $creating ? null : $this->route('branch')->id;
        $companyId = app(TenantContext::class)->id();

        return [
            'name' => [$required, 'string', 'max:150'],
            'code' => [$required, 'string', 'alpha_dash', 'max:30',
                Rule::unique('branches', 'code')->where('company_id', $companyId)->whereNull('deleted_at')->ignore($branchId)],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'is_head_office' => ['nullable', 'boolean'],
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

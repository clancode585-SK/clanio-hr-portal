<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $roleId = $creating ? null : $this->route('role')->id;
        $companyKey = app(TenantContext::class)->id() ?? 0;

        return [
            'name' => [$required, 'string', 'max:100'],
            'slug' => [$required, 'string', 'alpha_dash', 'min:3', 'max:100',
                Rule::unique('roles', 'slug')->where('company_key', $companyKey)->where('is_active', 1)->ignore($roleId)],
            'description' => ['nullable', 'string', 'max:500'],
            'hierarchy_level' => [$required, 'integer', 'between:2,99'],
            'data_scope' => [$required, Rule::in(['all_company', 'branch', 'department', 'team', 'self'])],
            'is_active' => ['nullable', 'boolean'],
            'permissions' => [$required, 'array', 'min:1'],
            'permissions.*' => ['string', Rule::exists('permissions', 'slug')],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('slug')) {
            $this->merge(['slug' => Str::snake(Str::lower((string) $this->input('slug')))]);
        }
    }
}

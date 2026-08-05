<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $userId = $creating ? null : $this->route('user')->id;
        $companyId = app(TenantContext::class)->id();

        return [
            'name' => [$required, 'string', 'max:150'],
            'email' => [$required, 'email', 'max:255',
                Rule::unique('users', 'email')->where('company_key', $companyId ?? 0)->where('is_active', 1)->ignore($userId)],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => [$required, 'string', Password::min(8)->letters()->numbers()],
            'branch_id' => ['nullable', 'integer',
                Rule::exists('branches', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'team_id' => ['nullable', 'integer',
                Rule::exists('teams', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'suspended'])],
            'role_ids' => [$required, 'array', 'min:1'],
            'role_ids.*' => ['integer', Rule::exists('roles', 'id')
                ->where(fn (Builder $query) => $companyId === null
                    ? $query->whereNull('company_id')
                    : $query->where('company_id', $companyId))
                ->where('is_active', 1)],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }
    }
}

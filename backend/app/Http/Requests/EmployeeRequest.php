<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class EmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $employeeId = $creating ? null : $this->route('employee')->id;
        $companyId = app(TenantContext::class)->id();

        return array_merge(
            $creating ? $this->userRules($companyId) : $this->lockedUserRules(),
            [
                'employee_code' => ['nullable', 'string', 'alpha_dash', 'max:30',
                    Rule::unique('employees', 'employee_code')->where('company_id', $companyId)->whereNull('deleted_at')->ignore($employeeId)],
                'designation_id' => ['nullable', 'integer',
                    Rule::exists('designations', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
                'reporting_manager_id' => ['nullable', 'integer',
                    Rule::exists('users', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
                'date_of_joining' => [$required, 'date'],
                'employment_type' => ['nullable', Rule::in(['full_time', 'part_time', 'intern', 'contract', 'consultant'])],
                'probation_end_date' => ['nullable', 'date', 'after_or_equal:date_of_joining'],
                'confirmation_date' => ['nullable', 'date', 'after_or_equal:date_of_joining'],
                'date_of_birth' => ['nullable', 'date', 'before:today'],
                'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
                'marital_status' => ['nullable', Rule::in(['single', 'married', 'divorced', 'widowed'])],
                'blood_group' => ['nullable', Rule::in(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])],
                'personal_email' => ['nullable', 'email', 'max:255'],
                'personal_phone' => ['nullable', 'string', 'max:20'],
                'current_address' => ['nullable', 'string', 'max:500'],
                'permanent_address' => ['nullable', 'string', 'max:500'],
                'emergency_contact_name' => ['nullable', 'string', 'max:150'],
                'emergency_contact_relation' => ['nullable', 'string', 'max:50'],
                'emergency_contact_phone' => ['nullable', 'string', 'max:20'],
                'pan_number' => ['nullable', 'string', 'size:10'],
            ]
        );
    }

    private function userRules(?int $companyId): array
    {
        return [
            'user_id' => ['nullable', 'required_without:user', 'integer',
                Rule::exists('users', 'id')->where('company_id', $companyId)->whereNull('deleted_at'),
                Rule::unique('employees', 'user_id')->whereNull('deleted_at')],

            'user' => ['nullable', 'required_without:user_id', 'prohibits:user_id', 'array'],
            'user.name' => ['required_with:user', 'string', 'max:150'],
            'user.email' => ['required_with:user', 'email', 'max:255',
                Rule::unique('users', 'email')->where('company_key', $companyId ?? 0)->whereNull('deleted_at')],
            'user.password' => ['required_with:user', 'string', Password::min(8)->letters()->numbers()],
            'user.phone' => ['nullable', 'string', 'max:20'],
            'user.branch_id' => ['nullable', 'integer',
                Rule::exists('branches', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'user.department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'user.team_id' => ['nullable', 'integer',
                Rule::exists('teams', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'user.role_ids' => ['nullable', 'array'],
            'user.role_ids.*' => ['integer', Rule::exists('roles', 'id')
                ->where(fn (Builder $query) => $companyId === null
                    ? $query->whereNull('company_id')
                    : $query->where('company_id', $companyId))
                ->whereNull('deleted_at')],
        ];
    }

    private function lockedUserRules(): array
    {
        $companyId = app(TenantContext::class)->id();
        $userId = $this->route('employee')?->user_id;

        return [
            'user_id' => ['prohibited'],
            'user' => ['nullable', 'array'],
            'user.name' => ['sometimes', 'string', 'max:150'],
            'user.email' => ['sometimes', 'email', 'max:255',
                Rule::unique('users', 'email')->where('company_key', $companyId ?? 0)->whereNull('deleted_at')->ignore($userId)],
            'user.phone' => ['nullable', 'string', 'max:20'],
            'user.department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('employee_code')) {
            $this->merge(['employee_code' => Str::upper(trim((string) $this->input('employee_code')))]);
        }

        if ($this->has('pan_number')) {
            $this->merge(['pan_number' => Str::upper(trim((string) $this->input('pan_number')))]);
        }
    }
}

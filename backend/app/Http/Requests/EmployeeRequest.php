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
                    Rule::unique('employees', 'employee_code')->where('company_id', $companyId)->where('is_active', 1)->ignore($employeeId)],
                'designation_id' => ['nullable', 'integer',
                    Rule::exists('designations', 'id')->where('company_id', $companyId)->where('is_active', 1)],
                'work_shift_id' => ['nullable', 'integer',
                    Rule::exists('work_shifts', 'id')->where('company_id', $companyId)->where('is_active', 1)],
                'reporting_manager_id' => ['nullable', 'integer',
                    Rule::exists('users', 'id')->where('company_id', $companyId)->where('is_active', 1)],
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

                'has_pf_account' => ['nullable', 'boolean'],
                'uan_number' => ['nullable', 'required_if:has_pf_account,true', 'string', 'digits:12',
                    Rule::unique('employees', 'uan_number')->where('company_id', $companyId)->where('is_active', 1)->ignore($employeeId)],
                'aadhaar_number' => ['nullable', 'string', 'digits:12',
                    Rule::unique('employees', 'aadhaar_number')->where('company_id', $companyId)->where('is_active', 1)->ignore($employeeId)],
                'esic_number' => ['nullable', 'string', 'digits:17'],
                'pt_state' => ['nullable', 'string', 'max:50'],
            ]
        );
    }

    private function userRules(?int $companyId): array
    {
        return [
            'user_id' => ['nullable', 'required_without:user', 'integer',
                Rule::exists('users', 'id')->where('company_id', $companyId)->where('is_active', 1),
                Rule::unique('employees', 'user_id')->where('is_active', 1)],

            'user' => ['nullable', 'required_without:user_id', 'prohibits:user_id', 'array'],
            'user.name' => ['required_with:user', 'string', 'max:150'],
            'user.email' => ['required_with:user', 'email', 'max:255',
                Rule::unique('users', 'email')->where('company_key', $companyId ?? 0)->where('is_active', 1)],
            'user.password' => ['required_with:user', 'string', Password::min(8)->letters()->numbers()],
            'user.phone' => ['nullable', 'string', 'max:20'],
            'user.branch_id' => ['nullable', 'integer',
                Rule::exists('branches', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'user.department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'user.team_id' => ['nullable', 'integer',
                Rule::exists('teams', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'user.role_ids' => ['required_with:user', 'array', 'min:1'],
            'user.role_ids.*' => ['integer', Rule::exists('roles', 'id')
                ->where(fn (Builder $query) => $companyId === null
                    ? $query->whereNull('company_id')
                    : $query->where('company_id', $companyId))
                ->where('is_active', 1)],
        ];
    }

    private function lockedUserRules(): array
    {
        return [
            'user' => ['prohibited'],
            'user_id' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'uan_number.required_if' => 'PF account hai to UAN number dena zaroori hai.',
            'uan_number.digits' => 'UAN 12 digit ka hota hai.',
            'uan_number.unique' => 'Ye UAN kisi aur employee par already laga hua hai.',
            'aadhaar_number.digits' => 'Aadhaar 12 digit ka hota hai.',
            'aadhaar_number.unique' => 'Ye Aadhaar kisi aur employee par already laga hua hai.',
            'esic_number.digits' => 'ESIC number 17 digit ka hota hai.',
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

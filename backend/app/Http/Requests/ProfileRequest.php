<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:150'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],

            'date_of_birth' => ['sometimes', 'nullable', 'date', 'before:today'],
            'gender' => ['sometimes', 'nullable', Rule::in(['male', 'female', 'other'])],
            'marital_status' => ['sometimes', 'nullable', Rule::in(['single', 'married', 'divorced', 'widowed'])],
            'blood_group' => ['sometimes', 'nullable', Rule::in(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])],
            'personal_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'personal_phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'current_address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'permanent_address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'emergency_contact_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'emergency_contact_relation' => ['sometimes', 'nullable', 'string', 'max:50'],
            'emergency_contact_phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'pan_number' => ['sometimes', 'nullable', 'string', 'size:10'],

            'has_pf_account' => ['sometimes', 'boolean'],
            'uan_number' => ['sometimes', 'nullable', 'required_if:has_pf_account,true', 'string', 'digits:12'],
            'aadhaar_number' => ['sometimes', 'nullable', 'string', 'digits:12'],

            'esic_number' => ['prohibited'],
            'pt_state' => ['prohibited'],
            'email' => ['prohibited'],
            'employee_code' => ['prohibited'],
            'designation_id' => ['prohibited'],
            'department_id' => ['prohibited'],
            'team_id' => ['prohibited'],
            'branch_id' => ['prohibited'],
            'reporting_manager_id' => ['prohibited'],
            'work_shift_id' => ['prohibited'],
            'date_of_joining' => ['prohibited'],
            'employment_type' => ['prohibited'],
            'status' => ['prohibited'],
            'role_ids' => ['prohibited'],
            'onboarding_status' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'prohibited' => 'You cannot change :attribute yourself. Ask HR to update it.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('pan_number') && $this->input('pan_number') !== null) {
            $this->merge(['pan_number' => Str::upper(trim((string) $this->input('pan_number')))]);
        }
    }
}

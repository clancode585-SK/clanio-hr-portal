<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\JobOpening;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class JobOpeningRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'max:200'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:150', 'regex:/^[a-z0-9-]+$/'],
            'location' => [$required, 'string', 'max:150'],
            'department_id' => ['nullable', 'integer', Rule::exists('departments', 'id')->where('company_id', $companyId)],
            'designation_id' => ['nullable', 'integer', Rule::exists('designations', 'id')->where('company_id', $companyId)],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'work_mode' => ['sometimes', Rule::in(JobOpening::WORK_MODES)],
            'employment_type' => ['sometimes', Rule::in(JobOpening::EMPLOYMENT_TYPES)],
            'experience_min' => ['sometimes', 'numeric', 'between:0,50'],
            'experience_max' => ['nullable', 'numeric', 'between:0,60'],
            'positions' => ['sometimes', 'integer', 'between:1,999'],
            'salary_min' => ['nullable', 'numeric', 'between:0,99999999'],
            'salary_max' => ['nullable', 'numeric', 'between:0,99999999'],
            'show_salary' => ['sometimes', 'boolean'],
            'summary' => ['nullable', 'string', 'max:500'],
            'responsibilities' => ['nullable', 'string', 'max:8000'],
            'requirements' => ['nullable', 'string', 'max:8000'],
            'nice_to_have' => ['nullable', 'string', 'max:4000'],
            'status' => ['sometimes', Rule::in(JobOpening::STATUSES)],
            'closes_on' => ['nullable', 'date', 'after_or_equal:today'],
        ];
    }

    public function messages(): array
    {
        return [
            'slug.regex' => 'The web address can only use lowercase letters, numbers and dashes.',
            'closes_on.after_or_equal' => 'The closing date cannot be in the past.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $min = $this->input('experience_min');
            $max = $this->input('experience_max');

            if ($min !== null && $max !== null && (float) $max < (float) $min) {
                $validator->errors()->add('experience_max', 'The upper experience cannot be lower than the lower one.');
            }

            $low = $this->input('salary_min');
            $high = $this->input('salary_max');

            if ($low !== null && $high !== null && (float) $high < (float) $low) {
                $validator->errors()->add('salary_max', 'The upper salary cannot be lower than the lower one.');
            }

            if ($this->input('status') === JobOpening::STATUS_OPEN) {
                foreach (['responsibilities' => 'responsibilities', 'requirements' => 'requirements'] as $field => $label) {
                    $value = $this->input($field, $this->route('opening')?->{$field});

                    if (JobOpening::lines($value) === []) {
                        $validator->errors()->add(
                            $field,
                            'Add at least one line of ' . $label . ' before publishing this opening.'
                        );
                    }
                }
            }
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\PerformanceGoal;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PerformanceGoalRequest extends FormRequest
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
            'employee_id' => ['nullable', 'integer',
                Rule::exists('employees', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'appraisal_cycle_id' => ['nullable', 'integer',
                Rule::exists('appraisal_cycles', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'parent_id' => ['nullable', 'integer',
                Rule::exists('performance_goals', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'goal_type' => ['nullable', Rule::in(PerformanceGoal::GOAL_TYPES)],
            'period_type' => ['nullable', Rule::in(PerformanceGoal::PERIOD_TYPES)],
            'period_label' => ['nullable', 'string', 'max:30'],

            'title' => [$required, 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:1000'],
            'metric' => ['nullable', 'string', 'max:100'],
            'target_value' => ['nullable', 'numeric', 'min:0'],
            'weight' => ['nullable', 'integer', 'between:0,100'],

            'start_date' => [$required, 'date'],
            'due_date' => [$required, 'date', 'after_or_equal:start_date'],

            'progress_source' => ['nullable', Rule::in(PerformanceGoal::SOURCES)],
            'task_ids' => ['nullable', 'array'],
            'task_ids.*' => ['integer',
                Rule::exists('tasks', 'id')->where('company_id', $companyId)->where('is_active', 1)],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Goal ka title likhna zaroori hai.',
            'due_date.after_or_equal' => 'Due date start date se pehle nahi ho sakti.',
        ];
    }
}

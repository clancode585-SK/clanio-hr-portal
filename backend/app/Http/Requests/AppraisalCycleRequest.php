<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\AppraisalCycle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AppraisalCycleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        if ($this->routeIs('*cycles.advance')) {
            return ['status' => ['required', Rule::in([
                AppraisalCycle::MANAGER_REVIEW,
                AppraisalCycle::HR_REVIEW,
                AppraisalCycle::CLOSED,
            ])]];
        }

        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:100'],
            'period_start' => [$required, 'date'],
            'period_end' => [$required, 'date', 'after_or_equal:period_start'],
            'self_review_due' => ['nullable', 'date'],
            'manager_review_due' => ['nullable', 'date', 'after_or_equal:self_review_due'],
            'rating_scale' => ['nullable', 'integer', 'between:3,10'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Cycle ka naam likhna zaroori hai — jaise "Q3 2026".',
            'period_end.after_or_equal' => 'Period end, start se pehle nahi ho sakta.',
        ];
    }
}

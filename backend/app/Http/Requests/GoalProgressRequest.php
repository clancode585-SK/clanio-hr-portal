<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\PerformanceGoal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GoalProgressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        if ($this->routeIs('*goals.close')) {
            return [
                'status' => ['nullable', Rule::in([
                    PerformanceGoal::ACHIEVED,
                    PerformanceGoal::MISSED,
                    PerformanceGoal::CANCELLED,
                ])],
                'remarks' => ['nullable', 'string', 'max:500'],
            ];
        }

        return [
            'progress_percent' => ['nullable', 'integer', 'between:0,100'],
            'achieved_value' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}

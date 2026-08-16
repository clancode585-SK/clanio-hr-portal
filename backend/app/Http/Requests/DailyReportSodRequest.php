<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DailyReportSodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'report_date' => ['nullable', 'date'],
            'sod_plan' => ['required_without:items', 'nullable', 'string', 'max:5000'],
            'items' => ['nullable', 'array', 'max:30'],
            'items.*.title' => ['required', 'string', 'max:200'],
            'items.*.task_id' => ['nullable', 'integer', 'exists:tasks,id'],
            'items.*.hours' => ['nullable', 'numeric', 'between:0.5,24'],
        ];
    }

    public function messages(): array
    {
        return [
            'sod_plan.required_without' => 'Plan likho ya kam se kam ek task add karo.',
        ];
    }
}

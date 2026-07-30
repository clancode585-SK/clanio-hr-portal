<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DailyReportEodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'report_date' => ['nullable', 'date'],
            'eod_summary' => ['required_without:items', 'nullable', 'string', 'max:5000'],
            'eod_blockers' => ['nullable', 'string', 'max:2000'],
            'eod_tomorrow_plan' => ['nullable', 'string', 'max:2000'],
            'worked_hours' => ['nullable', 'numeric', 'between:0,24'],
            'items' => ['nullable', 'array', 'max:30'],
            'items.*.title' => ['required', 'string', 'max:200'],
            'items.*.task_id' => ['nullable', 'integer', 'exists:tasks,id'],
            'items.*.hours' => ['nullable', 'numeric', 'between:0.5,24'],
            'items.*.is_completed' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'eod_summary.required_without' => 'Summary likho ya kam se kam ek kaam add karo.',
        ];
    }
}

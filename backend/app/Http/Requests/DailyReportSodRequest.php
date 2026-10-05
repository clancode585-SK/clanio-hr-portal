<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\DailyReportItem;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'items.*.hours' => ['nullable', 'numeric', 'between:0.1,24'],
            'items.*.status' => ['nullable', 'string', Rule::in(DailyReportItem::STATUSES)],
        ];
    }

    public function messages(): array
    {
        return [
            'sod_plan.required_without' => 'Write a plan, or add at least one task.',
        ];
    }
}

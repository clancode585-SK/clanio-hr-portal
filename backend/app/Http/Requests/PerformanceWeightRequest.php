<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PerformanceWeightRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'delivery' => ['required', 'integer', 'between:0,100'],
            'discipline' => ['required', 'integer', 'between:0,100'],
            'overdue_penalty' => ['nullable', 'integer', 'between:0,50'],
            'absent_penalty' => ['nullable', 'integer', 'between:0,50'],
            'missed_report_penalty' => ['nullable', 'integer', 'between:0,50'],
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CompanySettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sod_cutoff' => ['nullable', 'date_format:H:i'],
            'eod_cutoff' => ['nullable', 'date_format:H:i'],
            'regularization_days' => ['nullable', 'integer', 'between:0,90'],
            'expense_claim_days' => ['nullable', 'integer', 'between:1,365'],
            'notice_period_days' => ['nullable', 'integer', 'between:0,180'],
            'policy_gate_enabled' => ['nullable', 'boolean'],
            'ticket_sla_enabled' => ['nullable', 'boolean'],
            'fiscal_year_start' => ['nullable', 'integer', 'between:1,12'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'currency' => ['nullable', 'string', 'size:3'],
        ];
    }

    public function messages(): array
    {
        return [
            'sod_cutoff.date_format' => 'Time 24 ghante ke format mein do — jaise 10:30',
            'eod_cutoff.date_format' => 'Time 24 ghante ke format mein do — jaise 19:30',
            'regularization_days.between' => 'Regularization window 0 se 90 din ke beech rakho.',
            'expense_claim_days.between' => 'Expense claim window 1 se 365 din ke beech rakho.',
            'notice_period_days.between' => 'Notice period 0 se 180 din ke beech rakho.',
        ];
    }
}

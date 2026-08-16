<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LeaveBalanceAdjustRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'days' => ['required', 'numeric', 'between:-365,365', 'not_in:0'],
            'remarks' => ['required', 'string', 'min:3', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'days.not_in' => 'Adjustment 0 din ka nahi ho sakta.',
            'remarks.required' => 'Adjustment ki wajah likhna zaroori hai.',
        ];
    }
}

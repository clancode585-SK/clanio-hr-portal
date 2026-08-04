<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegularizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'attendance_date' => ['required', 'date', 'before_or_equal:today'],
            'requested_check_in' => ['nullable', 'date_format:H:i'],
            'requested_check_out' => ['nullable', 'date_format:H:i'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'attendance_date.before_or_equal' => 'Aane wale din ki regularization nahi hoti.',
            'requested_check_in.date_format' => 'Time 24 ghante ke format mein do — jaise 09:30',
            'requested_check_out.date_format' => 'Time 24 ghante ke format mein do — jaise 18:45',
            'reason.min' => 'Reason thoda detail mein likho.',
        ];
    }
}

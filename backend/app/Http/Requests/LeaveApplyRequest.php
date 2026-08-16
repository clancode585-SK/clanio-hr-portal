<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\LeaveRequest;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LeaveApplyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();

        return [
            'employee_id' => ['nullable', 'integer',
                Rule::exists('employees', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'leave_type_id' => ['required', 'integer',
                Rule::exists('leave_types', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'from_date' => ['required', 'date_format:Y-m-d'],
            'to_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:from_date'],
            'is_half_day' => ['nullable', 'boolean'],
            'half_day_session' => ['nullable', 'required_if:is_half_day,true', Rule::in(LeaveRequest::SESSIONS)],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'document_id' => ['nullable', 'integer',
                Rule::exists('employee_documents', 'id')->where('company_id', $companyId)->where('is_active', 1)],
        ];
    }

    public function messages(): array
    {
        return [
            'to_date.after_or_equal' => 'To date, from date se pehle nahi ho sakti.',
            'half_day_session.required_if' => 'Half day ke liye first_half ya second_half chunna padega.',
        ];
    }
}

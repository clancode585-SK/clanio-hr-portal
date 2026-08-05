<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\LeaveType;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LeaveTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $typeId = $creating ? null : $this->route('leaveType')->id;
        $companyId = app(TenantContext::class)->id();

        return [
            'name' => [$required, 'string', 'max:100'],
            'code' => [$required, 'string', 'alpha_dash', 'max:20',
                Rule::unique('leave_types', 'code')->where('company_id', $companyId)->where('is_active', 1)->ignore($typeId)],
            'description' => ['nullable', 'string', 'max:500'],
            'is_paid' => ['nullable', 'boolean'],
            'annual_quota' => ['nullable', 'numeric', 'between:0,365'],
            'accrual_type' => ['nullable', Rule::in(LeaveType::ACCRUALS)],
            'allow_half_day' => ['nullable', 'boolean'],
            'min_notice_days' => ['nullable', 'integer', 'between:0,365'],
            'max_consecutive_days' => ['nullable', 'integer', 'between:1,365'],
            'carry_forward' => ['nullable', 'boolean'],
            'carry_forward_max' => ['nullable', 'numeric', 'between:0,365'],
            'is_encashable' => ['nullable', 'boolean'],
            'encashment_max' => ['nullable', 'numeric', 'between:0,365'],
            'applicable_to' => ['nullable', Rule::in(LeaveType::AUDIENCES)],
            'min_service_months' => ['nullable', 'integer', 'between:0,120'],
            'count_weekly_off' => ['nullable', 'boolean'],
            'count_holiday' => ['nullable', 'boolean'],
            'requires_document' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'between:0,255'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => Str::upper(trim((string) $this->input('code')))]);
        }
    }
}

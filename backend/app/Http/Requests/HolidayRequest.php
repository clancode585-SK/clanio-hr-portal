<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Holiday;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class HolidayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $holiday = $creating ? null : $this->route('holiday');
        $holidayId = $holiday?->id;
        $companyId = app(TenantContext::class)->id();
        $branchId = $this->has('branch_id') ? $this->input('branch_id') : $holiday?->branch_id;

        return [
            'name' => [$required, 'string', 'max:150'],
            'holiday_date' => [$required, 'date_format:Y-m-d',
                Rule::unique('holidays', 'holiday_date')
                    ->where('company_id', $companyId)
                    ->where('branch_id', $branchId)
                    ->where('is_active', 1)
                    ->ignore($holidayId)],
            'branch_id' => ['nullable', 'integer',
                Rule::exists('branches', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'type' => ['nullable', Rule::in([Holiday::PUBLIC, Holiday::OPTIONAL, Holiday::RESTRICTED])],
            'is_paid' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'holiday_date.unique' => 'A holiday already exists on this date for the selected branch.',
        ];
    }
}

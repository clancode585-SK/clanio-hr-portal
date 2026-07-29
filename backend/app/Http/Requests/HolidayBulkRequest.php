<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Holiday;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class HolidayBulkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();

        return [
            'holidays' => ['required', 'array', 'min:1', 'max:100'],
            'holidays.*.name' => ['required', 'string', 'max:150'],
            'holidays.*.holiday_date' => ['required', 'date_format:Y-m-d',
                Rule::unique('holidays', 'holiday_date')->where('company_id', $companyId)->whereNull('deleted_at')],
            'holidays.*.branch_id' => ['nullable', 'integer',
                Rule::exists('branches', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'holidays.*.type' => ['nullable', Rule::in([Holiday::PUBLIC, Holiday::OPTIONAL, Holiday::RESTRICTED])],
            'holidays.*.is_paid' => ['nullable', 'boolean'],
            'holidays.*.description' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $seen = [];

            foreach ((array) $this->input('holidays', []) as $index => $holiday) {
                $key = ($holiday['branch_id'] ?? 0) . ':' . ($holiday['holiday_date'] ?? '');

                if (isset($seen[$key])) {
                    $validator->errors()->add("holidays.{$index}.holiday_date", 'This date is repeated in the list.');
                }

                $seen[$key] = true;
            }
        });
    }

    public function messages(): array
    {
        return [
            'holidays.*.holiday_date.unique' => 'A holiday already exists on this date.',
        ];
    }
}

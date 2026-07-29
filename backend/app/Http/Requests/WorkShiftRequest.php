<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class WorkShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $shiftId = $creating ? null : $this->route('workShift')->id;
        $companyId = app(TenantContext::class)->id();

        return [
            'name' => [$required, 'string', 'max:150'],
            'code' => [$required, 'string', 'alpha_dash', 'max:30',
                Rule::unique('work_shifts', 'code')->where('company_id', $companyId)->whereNull('deleted_at')->ignore($shiftId)],
            'start_time' => [$required, 'date_format:H:i'],
            'end_time' => [$required, 'date_format:H:i'],
            'grace_minutes' => ['nullable', 'integer', 'between:0,240'],
            'half_day_minutes' => ['nullable', 'integer', 'between:1,1440'],
            'full_day_minutes' => ['nullable', 'integer', 'between:1,1440', 'gte:half_day_minutes'],
            'weekly_offs' => [$required, 'array'],
            'weekly_offs.*' => ['integer', 'between:0,6'],
            'is_default' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }

    public function messages(): array
    {
        return [
            'weekly_offs.*.between' => 'Weekly off days must be 0 (Sunday) to 6 (Saturday).',
            'full_day_minutes.gte' => 'Full day minutes cannot be less than half day minutes.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => Str::upper(trim((string) $this->input('code')))]);
        }

        if (is_array($this->input('weekly_offs'))) {
            $this->merge(['weekly_offs' => array_values(array_unique($this->input('weekly_offs')))]);
        }
    }
}

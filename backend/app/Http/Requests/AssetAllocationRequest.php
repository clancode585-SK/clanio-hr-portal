<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Asset;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssetAllocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();

        if ($this->routeIs('*assets.return')) {
            return [
                'returned_on' => ['nullable', 'date', 'before_or_equal:today'],
                'condition' => ['nullable', Rule::in(Asset::CONDITIONS)],
                'recoverable_amount' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
                'remarks' => ['nullable', 'string', 'max:500'],
            ];
        }

        if ($this->routeIs('*assets.retire')) {
            return [
                'status' => ['nullable', Rule::in([Asset::RETIRED, Asset::LOST])],
                'notes' => ['nullable', 'string', 'max:500'],
            ];
        }

        return [
            'employee_id' => ['required', 'integer',
                Rule::exists('employees', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'allocated_on' => ['nullable', 'date', 'before_or_equal:today'],
            'expected_return_date' => ['nullable', 'date', 'after_or_equal:allocated_on'],
            'condition' => ['nullable', Rule::in(Asset::CONDITIONS)],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return ['employee_id.required' => 'Kis employee ko dena hai wo chunna zaroori hai.'];
    }
}

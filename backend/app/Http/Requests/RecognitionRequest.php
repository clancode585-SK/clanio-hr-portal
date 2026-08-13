<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Recognition;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecognitionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();

        if ($this->routeIs('*incentives.approve') || $this->routeIs('*incentives.reject')) {
            return [
                'remarks' => ['nullable', 'string', 'max:500'],
                'reason' => [$this->routeIs('*incentives.reject') ? 'required' : 'nullable', 'string', 'max:500'],
            ];
        }

        return [
            'employee_id' => ['required', 'integer',
                Rule::exists('employees', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'performance_goal_id' => ['nullable', 'integer',
                Rule::exists('performance_goals', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'type' => ['nullable', Rule::in(array_keys(Recognition::TYPES))],
            'title' => ['required', 'string', 'max:200'],
            'message' => ['nullable', 'string', 'max:1000'],
            'points' => ['nullable', 'integer', 'between:0,10000'],
            'visibility' => ['nullable', Rule::in([Recognition::PUBLIC, Recognition::PRIVATE])],
            'awarded_on' => ['nullable', 'date', 'before_or_equal:today'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Kis cheez ke liye de rahe ho, wo likho.',
            'reason.required' => 'Reject karne ki wajah likhni zaroori hai.',
        ];
    }
}

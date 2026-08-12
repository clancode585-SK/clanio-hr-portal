<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Asset;
use App\Models\AssetRequest;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssetRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();

        if ($this->routeIs('*asset-requests.reject')) {
            return ['reason' => ['required', 'string', 'min:3', 'max:500']];
        }

        if ($this->routeIs('*asset-requests.approve')) {
            return ['remarks' => ['nullable', 'string', 'max:500']];
        }

        if ($this->routeIs('*asset-requests.resolve')) {
            return [
                'resolution' => ['required', 'string', 'min:3', 'max:1000'],
                'condition' => ['nullable', Rule::in(Asset::CONDITIONS)],
            ];
        }

        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';

        return [
            'employee_id' => ['nullable', 'integer',
                Rule::exists('employees', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'request_type' => [$required, Rule::in(array_keys(AssetRequest::TYPES))],
            'asset_id' => ['nullable', 'integer',
                Rule::exists('assets', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'category' => ['nullable', Rule::in(array_keys(Asset::CATEGORIES))],
            'title' => [$required, 'string', 'max:200'],
            'description' => [$required, 'string', 'min:5', 'max:1000'],
            'priority' => ['nullable', Rule::in(AssetRequest::PRIORITIES)],
        ];
    }

    public function messages(): array
    {
        return [
            'description.required' => 'Issue ya zarurat detail me likho.',
            'reason.required' => 'Reject karne ki wajah likhni zaroori hai.',
            'resolution.required' => 'Kya kiya wo likhna zaroori hai.',
        ];
    }
}

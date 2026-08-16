<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Asset;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AssetStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $companyId = app(TenantContext::class)->id();
        $assetId = $creating ? null : $this->route('asset')->id;

        return [
            'asset_code' => ['nullable', 'string', 'alpha_dash', 'max:30',
                Rule::unique('assets', 'asset_code')->where('company_id', $companyId)->where('is_active', 1)->ignore($assetId)],
            'category' => [$required, Rule::in(array_keys(Asset::CATEGORIES))],
            'name' => [$required, 'string', 'max:150'],
            'brand' => ['nullable', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:80'],
            'serial_number' => ['nullable', 'string', 'max:100',
                Rule::unique('assets', 'serial_number')->where('company_id', $companyId)->where('is_active', 1)->ignore($assetId)],
            'purchase_date' => ['nullable', 'date', 'before_or_equal:today'],
            'purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'warranty_expiry' => ['nullable', 'date', 'after_or_equal:purchase_date'],
            'condition_state' => ['nullable', Rule::in(Asset::CONDITIONS)],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'serial_number.unique' => 'Ye serial number already kisi asset par hai.',
            'category.required' => 'Category chunni zaroori hai.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('asset_code')) {
            $this->merge(['asset_code' => Str::upper(trim((string) $this->input('asset_code')))]);
        }
    }
}

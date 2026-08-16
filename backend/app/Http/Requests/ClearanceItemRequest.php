<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\ClearanceItem;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClearanceItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $itemId = $creating ? null : $this->route('item')->id;
        $companyId = app(TenantContext::class)->id();

        return [
            'department' => [$required, Rule::in(array_keys(ClearanceItem::DEPARTMENTS))],
            'title' => [$required, 'string', 'max:150',
                Rule::unique('clearance_items', 'title')
                    ->where('company_id', $companyId)
                    ->where('department', $this->input('department'))
                    ->where('is_active', 1)
                    ->ignore($itemId)],
            'description' => ['nullable', 'string', 'max:500'],
            'is_recoverable' => ['nullable', 'boolean'],
            'is_mandatory' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'between:0,255'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.unique' => 'Is department me ye item already hai.',
            'department.required' => 'Department chunna zaroori hai — it / finance / hr / manager.',
        ];
    }
}

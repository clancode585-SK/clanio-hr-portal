<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserPermissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        if ($this->routeIs('*companies.modules')) {
            return [
                'modules' => ['required', 'array', 'min:1'],
                'modules.*' => ['boolean'],
            ];
        }

        return [
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'slug')],
        ];
    }

    public function messages(): array
    {
        return [
            'permissions.present' => 'Permission list bhejni zaroori hai — khali array bhi chalega.',
            'modules.required' => 'Kaunse module on/off karne hain wo bhejo.',
        ];
    }
}

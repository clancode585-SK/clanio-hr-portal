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
            'permissions.present' => 'A permission list is required — an empty array is fine.',
            'modules.required' => 'Send which modules to switch on or off.',
        ];
    }
}

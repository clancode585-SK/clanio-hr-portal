<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OkrVerifyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->routeIs('*goals.submit') ? 'required' : 'nullable';

        return [
            'achieved_value' => [$required, 'numeric', 'min:0'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return ['achieved_value.required' => 'Kitna achieve kiya wo number dena zaroori hai.'];
    }
}

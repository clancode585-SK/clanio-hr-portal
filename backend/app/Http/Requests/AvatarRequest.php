<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'avatar' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:min_width=100,min_height=100'],
        ];
    }

    public function messages(): array
    {
        return [
            'avatar.max' => 'The photo must be 2 MB or smaller.',
            'avatar.dimensions' => 'The photo must be at least 100x100 pixels.',
        ];
    }
}

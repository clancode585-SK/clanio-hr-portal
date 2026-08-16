<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AppraisalReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'rating' => ['required', 'numeric', 'min:1', 'max:10'],
            'comments' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return ['rating.required' => 'Rating dena zaroori hai.'];
    }
}

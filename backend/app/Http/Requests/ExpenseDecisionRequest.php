<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExpenseDecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        if ($this->routeIs('*reject')) {
            return ['reason' => ['required', 'string', 'min:3', 'max:500']];
        }

        return ['remarks' => ['nullable', 'string', 'max:500']];
    }

    public function messages(): array
    {
        return ['reason.required' => 'Reject karne ki wajah likhni zaroori hai.'];
    }
}

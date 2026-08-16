<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExitDecisionRequest extends FormRequest
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

        if ($this->routeIs('*exits.complete')) {
            return [
                'force' => ['nullable', 'boolean'],
                'force_reason' => ['nullable', 'required_if:force,true', 'string', 'min:3', 'max:500'],
            ];
        }

        if ($this->routeIs('*last-working-date')) {
            return [
                'last_working_date' => ['required', 'date'],
                'remarks' => ['nullable', 'string', 'max:500'],
            ];
        }

        return [
            'last_working_date' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Reject karne ki wajah likhni zaroori hai.',
            'last_working_date.required' => 'Nayi last working date deni zaroori hai.',
        ];
    }
}

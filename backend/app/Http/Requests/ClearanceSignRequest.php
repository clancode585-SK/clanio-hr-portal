<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\ExitClearance;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClearanceSignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(ExitClearance::STATUSES)],
            'remarks' => ['nullable', 'string', 'max:500'],
            'recoverable_amount' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
        ];
    }

    public function messages(): array
    {
        return ['status.required' => 'Status dena zaroori hai — cleared / blocked / not_applicable.'];
    }
}

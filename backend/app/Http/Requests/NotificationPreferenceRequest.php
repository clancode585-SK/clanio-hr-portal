<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\NotificationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class NotificationPreferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'preferences' => ['required', 'array', 'min:1'],
            'preferences.*.scope' => ['required', Rule::in(NotificationType::GROUPS)],
            'preferences.*.in_app' => ['required', 'boolean'],
            'preferences.*.push' => ['required', 'boolean'],
            'preferences.*.email' => ['nullable', 'boolean'],
        ];
    }
}

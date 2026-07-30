<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\DeviceToken;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DeviceTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'platform' => ['required', Rule::in(DeviceToken::PLATFORMS)],
            'token' => ['required', 'string', 'max:512'],
            'device_id' => ['nullable', 'string', 'max:120'],
            'device_name' => ['nullable', 'string', 'max:120'],
            'app_version' => ['nullable', 'string', 'max:20'],
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\NotificationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class NotificationAnnounceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'body' => ['nullable', 'string', 'max:500'],
            'action_url' => ['nullable', 'string', 'max:255'],
            'priority' => ['nullable', Rule::in(NotificationType::PRIORITIES)],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'team_id' => ['nullable', 'integer', 'exists:teams,id'],
            'payload' => ['nullable', 'array'],
        ];
    }
}

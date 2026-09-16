<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Ticket;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TicketSlaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'slas' => ['required', 'array', 'min:1', 'max:4'],
            'slas.*.priority' => ['required', 'string', Rule::in(Ticket::PRIORITIES)],
            'slas.*.response_hours' => ['required', 'integer', 'between:1,720'],
            'slas.*.resolution_hours' => ['required', 'integer', 'between:1,2160'],
        ];
    }

    public function messages(): array
    {
        return [
            'slas.required' => 'Send at least one priority to update.',
            'slas.*.priority.in' => 'Priority must be low, medium, high or urgent.',
            'slas.*.response_hours.between' => 'First response must be between 1 and 720 hours.',
            'slas.*.resolution_hours.between' => 'Resolution must be between 1 and 2160 hours.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $seen = [];

            foreach ((array) $this->input('slas', []) as $index => $row) {
                $priority = $row['priority'] ?? null;

                if ($priority !== null && in_array($priority, $seen, true)) {
                    $validator->errors()->add('slas.' . $index . '.priority', 'This priority is listed twice.');
                }

                $seen[] = $priority;

                $response = (int) ($row['response_hours'] ?? 0);
                $resolution = (int) ($row['resolution_hours'] ?? 0);

                if ($response > 0 && $resolution > 0 && $resolution < $response) {
                    $validator->errors()->add(
                        'slas.' . $index . '.resolution_hours',
                        'Resolution cannot be quicker than the first response.'
                    );
                }
            }
        });
    }
}

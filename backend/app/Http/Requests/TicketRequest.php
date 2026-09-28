<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Ticket;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();

        if ($this->routeIs('*tickets.resolve')) {
            return ['resolution_note' => ['required', 'string', 'min:3', 'max:1000']];
        }

        if ($this->routeIs('*tickets.reopen') || $this->routeIs('*tickets.ask-info')) {
            return ['body' => ['required', 'string', 'min:3', 'max:2000']];
        }

        if ($this->routeIs('*tickets.assign')) {
            return [
                'user_id' => ['required', 'integer',
                    Rule::exists('users', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            ];
        }

        if ($this->routeIs('*tickets.comment')) {
            return [
                'body' => ['required', 'string', 'min:1', 'max:2000'],
                'is_internal' => ['nullable', 'boolean'],
            ];
        }

        return [
            'category_id' => ['required', 'integer',
                Rule::exists('ticket_categories', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'route_id' => ['nullable', 'integer',
                Rule::exists('ticket_category_routes', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'subject' => ['required', 'string', 'min:3', 'max:200'],
            'message' => ['required', 'string', 'min:5', 'max:5000'],
            'priority' => ['nullable', Rule::in(Ticket::PRIORITIES)],
        ];
    }

    public function messages(): array
    {
        return [
            'category_id.required' => 'A category is required.',
            'subject.required' => 'Subject likho.',
            'message.required' => 'Problem detail me likho.',
            'resolution_note.required' => 'Say what was done.',
            'body.required' => 'The message cannot be empty.',
            'user_id.required' => 'Choose who to assign it to.',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\TicketCategoryRoute;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TicketCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = app(TenantContext::class)->id();
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $categoryId = $this->route('category')?->id;

        return [
            'name' => [$required, 'string', 'max:120'],
            'code' => [$required, 'string', 'max:40', 'regex:/^[a-z0-9_]+$/',
                Rule::unique('ticket_categories', 'code')
                    ->where('company_id', $companyId)
                    ->where('is_active', 1)
                    ->ignore($categoryId)],
            'scope' => ['nullable', Rule::in(TicketCategory::SCOPES)],
            'default_priority' => ['nullable', Rule::in(Ticket::PRIORITIES)],
            'support_email' => ['nullable', 'email', 'max:255'],
            'response_hours' => ['nullable', 'integer', 'between:1,720'],
            'resolution_hours' => ['nullable', 'integer', 'between:1,2160'],
            'sort_order' => ['nullable', 'integer', 'between:0,999'],
            'is_active' => ['nullable', 'boolean'],

            'routes' => [$required, 'array', 'min:1'],
            'routes.*.route_to' => ['required', Rule::in(TicketCategoryRoute::TARGETS)],
            'routes.*.label' => ['required', 'string', 'max:80'],
            'routes.*.hint' => ['nullable', 'string', 'max:200'],
            'routes.*.is_default' => ['nullable', 'boolean'],
            'routes.*.sort_order' => ['nullable', 'integer', 'between:0,999'],
            'routes.*.department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('company_id', $companyId)->where('is_active', 1)],
            'routes.*.user_id' => ['nullable', 'integer',
                Rule::exists('users', 'id')->where('company_id', $companyId)->where('is_active', 1)],
        ];
    }

    public function messages(): array
    {
        return [
            'code.regex' => 'Code me sirf chhote akshar, number aur underscore chalega.',
            'routes.required' => 'Kam se kam ek rasta banana zaroori hai.',
            'routes.*.label.required' => 'Har raste ka naam likho.',
        ];
    }
}

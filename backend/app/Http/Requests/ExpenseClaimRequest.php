<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\ExpenseClaim;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExpenseClaimRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'category' => [$required, Rule::in(array_keys(ExpenseClaim::CATEGORIES))],
            'purpose' => ['nullable', 'string', 'max:150'],
            'expense_date' => [$required, 'date', 'before_or_equal:today'],
            'amount' => [$required, 'numeric', 'min:0.01', 'max:9999999.99'],
            'description' => [$required, 'string', 'min:3', 'max:500'],
            'bills' => ['nullable', 'array', 'max:5'],
            'bills.*' => ['file', 'max:10240', 'mimes:jpg,jpeg,png,webp,pdf,doc,docx,xls,xlsx'],
        ];
    }

    public function messages(): array
    {
        return [
            'expense_date.before_or_equal' => 'Expenses cannot be claimed for a future date.',
            'amount.min' => 'The amount must be more than zero.',
            'description.min' => 'Describe the expense in a little more detail.',
            'bills.max' => 'No more than five bills on a claim.',
            'bills.*.max' => 'Each bill must be smaller than 10 MB.',
        ];
    }
}

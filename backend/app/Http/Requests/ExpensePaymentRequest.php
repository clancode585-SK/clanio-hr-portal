<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\ExpenseClaim;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExpensePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = [
            'payment_mode' => ['required', Rule::in(ExpenseClaim::PAYMENT_MODES)],
            'payment_reference' => ['nullable', 'string', 'max:80'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:today'],
            'payment_remarks' => ['nullable', 'string', 'max:300'],
        ];

        if ($this->routeIs('*pay-many')) {
            $rules['claims'] = ['required', 'array', 'min:1', 'max:200'];
            $rules['claims.*'] = ['required', 'string', 'size:36'];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'payment_mode.required' => 'Payment ka mode chuno — bank transfer, UPI, cash ya payroll.',
            'paid_on.before_or_equal' => 'Payment ki date aane wale din ki nahi ho sakti.',
            'claims.required' => 'Kaunsi claims pay karni hain wo bhejo.',
        ];
    }
}

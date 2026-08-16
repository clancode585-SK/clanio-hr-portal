<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExpenseBillRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'bill' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,webp,pdf,doc,docx,xls,xlsx'],
        ];
    }

    public function messages(): array
    {
        return [
            'bill.required' => 'Bill ki file bhejo.',
            'bill.max' => 'Bill 10 MB se chhota hona chahiye.',
            'bill.mimes' => 'Sirf image, PDF, Word ya Excel file chalegi.',
        ];
    }
}

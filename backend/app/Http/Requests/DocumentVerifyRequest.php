<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\EmployeeDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DocumentVerifyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([EmployeeDocument::VERIFIED, EmployeeDocument::REJECTED])],
            'remarks' => ['nullable', 'required_if:status,' . EmployeeDocument::REJECTED, 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'remarks.required_if' => 'Tell the employee why the document was rejected.',
        ];
    }
}

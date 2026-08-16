<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\EmployeeDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EmployeeDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            'type' => ['required', Rule::in(array_keys(EmployeeDocument::TYPES))],
            'title' => ['nullable', 'string', 'max:150'],
            'document_number' => ['nullable', 'string', 'max:60'],
            'issued_on' => ['nullable', 'date'],
            'expires_on' => ['nullable', 'date', 'after:issued_on'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.max' => 'The file must be 5 MB or smaller.',
            'file.mimes' => 'Only JPG, PNG, WEBP or PDF files are allowed.',
            'type.in' => 'Unknown document type. Allowed: ' . implode(', ', array_keys(EmployeeDocument::TYPES)) . '.',
        ];
    }
}

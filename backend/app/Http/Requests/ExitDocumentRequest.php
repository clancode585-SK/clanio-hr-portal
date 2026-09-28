<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\ExitDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExitDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(array_keys(ExitDocument::TYPES))],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:5120'],
            'issued_on' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:300'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'The letter file must be uploaded.',
            'file.max' => 'The file must not be larger than 5 MB.',
        ];
    }
}

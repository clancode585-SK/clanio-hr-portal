<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TaskAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,txt,zip'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.max' => 'File 10 MB se badi nahi ho sakti.',
            'file.mimes' => 'Ye file type allowed nahi hai.',
        ];
    }
}

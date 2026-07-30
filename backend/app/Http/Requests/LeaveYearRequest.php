<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LeaveYearRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'year' => ['nullable', 'integer', 'between:2000,2100'],
        ];
    }

    public function year(): int
    {
        return (int) ($this->validated('year') ?? now()->year);
    }
}

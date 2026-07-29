<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\EmployeeFamilyMember;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EmployeeFamilyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:150'],
            'relation' => [$required, Rule::in(EmployeeFamilyMember::RELATIONS)],
            'date_of_birth' => ['nullable', 'date', 'before:today'],
            'occupation' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:20'],
            'is_dependent' => ['nullable', 'boolean'],
            'is_nominee' => ['nullable', 'boolean'],
            'nominee_share' => ['nullable', 'numeric', 'between:0.01,100', 'required_if:is_nominee,true'],
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class WorkRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'month' => ['nullable', 'date_format:Y-m'],
        ];
    }

    public function month(): string
    {
        return $this->validated('month') ?? Carbon::today()->format('Y-m');
    }

    public function employeeId(): ?int
    {
        $id = $this->validated('employee_id');

        return $id === null ? null : (int) $id;
    }
}

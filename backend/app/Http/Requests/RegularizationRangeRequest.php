<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class RegularizationRangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ];
    }

    public function from(): string
    {
        $from = $this->validated('from');

        return $from === null
            ? Carbon::today()->subDays(30)->toDateString()
            : Carbon::parse($from)->toDateString();
    }

    public function to(): string
    {
        $to = $this->validated('to');

        return $to === null ? Carbon::today()->toDateString() : Carbon::parse($to)->toDateString();
    }

    public function employeeId(): ?int
    {
        $id = $this->validated('employee_id');

        return $id === null ? null : (int) $id;
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class DailyReportDateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['nullable', 'date'],
        ];
    }

    public function reportDate(): string
    {
        $date = $this->validated('date');

        return $date === null
            ? Carbon::today()->toDateString()
            : Carbon::parse($date)->toDateString();
    }
}

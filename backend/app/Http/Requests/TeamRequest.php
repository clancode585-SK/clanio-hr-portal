<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $team = $creating ? null : $this->route('team');
        $companyId = app(TenantContext::class)->id();

        $departmentId = $this->input('department_id', $team?->department_id);

        $departmentRule = Rule::exists('departments', 'id')->whereNull('deleted_at');
        if ($companyId !== null) {
            $departmentRule->where('company_id', $companyId);
        }

        $codeRule = Rule::unique('teams', 'code')
            ->where('department_id', $departmentId)
            ->whereNull('deleted_at')
            ->ignore($team?->id);

        return [
            'name' => [$required, 'string', 'max:150'],
            'code' => [$required, 'string', 'alpha_dash', 'max:30', $codeRule],
            'description' => ['nullable', 'string', 'max:500'],
            'department_id' => [$required, 'integer', $departmentRule],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => Str::upper((string) $this->input('code'))]);
        }
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Policy;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PolicyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        if ($this->routeIs('*policies.acknowledge')) {
            return ['note' => ['nullable', 'string', 'max:500']];
        }

        $creating = $this->isMethod('POST');
        $required = $creating ? 'required' : 'sometimes';
        $companyId = app(TenantContext::class)->id();
        $policyId = $creating ? null : $this->route('policy')->id;

        return [
            'category' => [$required, Rule::in(array_keys(Policy::CATEGORIES))],
            'title' => [$required, 'string', 'max:200'],
            'version' => ['nullable', 'string', 'max:20',
                Rule::unique('policies', 'version')
                    ->where('company_id', $companyId)
                    ->where('title', $this->input('title'))
                    ->where('is_active', 1)
                    ->ignore($policyId)],
            'summary' => ['nullable', 'string', 'max:500'],
            'body' => ['nullable', 'string', 'max:200000'],
            'file' => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:10240'],
            'effective_from' => [$required, 'date'],
            'review_on' => ['nullable', 'date', 'after:effective_from'],
            'needs_ack' => ['nullable', 'boolean'],
            'ack_due_days' => ['nullable', 'integer', 'between:1,180'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Policy ka title likhna zaroori hai.',
            'version.unique' => 'Is title ki ye version already hai — version badhao.',
            'file.max' => 'File 10 MB se badi nahi honi chahiye.',
        ];
    }
}

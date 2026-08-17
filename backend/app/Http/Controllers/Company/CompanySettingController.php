<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\CompanySettingRequest;
use App\Models\Company;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanySettingController extends ApiController
{
    public function show(Request $request): JsonResponse
    {
        return ApiResponse::success($this->payload($this->company()), 'Company settings fetched successfully');
    }

    public function update(CompanySettingRequest $request): JsonResponse
    {
        $company = $this->company();
        $data = array_filter(
            $request->validated(),
            static fn ($value): bool => $value !== null
        );

        if ($data === []) {
            throw new ApiException('Badalne ke liye kuch bheja hi nahi.', 422, 'NOTHING_TO_UPDATE');
        }

        foreach (['sod_cutoff', 'eod_cutoff'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = substr($data[$field], 0, 5) . ':00';
            }
        }

        $company->forceFill($data + ['updated_by' => $request->user()->id])->save();

        TenantCache::flush(TenantCache::COMPANIES);

        return ApiResponse::success($this->payload($company->refresh()), 'Company settings update ho gayi');
    }

    private function company(): Company
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'Company context nahi mila. Super admin ho to X-Company-Id header bhejo.',
                422,
                'TENANT_REQUIRED'
            );
        }

        $company = Company::query()->whereKey($id)->first();

        if ($company === null) {
            throw new ApiException('Company not found.', 404, 'NOT_FOUND');
        }

        return $company;
    }

    private function payload(Company $company): array
    {
        return [
            'company_id' => (int) $company->id,
            'name' => $company->name,
            'slug' => $company->slug,
            'status' => $company->status,
            'settings' => [
                'sod_cutoff' => substr((string) $company->sod_cutoff, 0, 5),
                'eod_cutoff' => substr((string) $company->eod_cutoff, 0, 5),
                'regularization_days' => (int) $company->regularization_days,
                'expense_claim_days' => (int) $company->expense_claim_days,
                'notice_period_days' => (int) $company->notice_period_days,
                'policy_gate_enabled' => (bool) $company->policy_gate_enabled,
                'ticket_sla_enabled' => (bool) $company->ticket_sla_enabled,
                'fiscal_year_start' => (int) $company->fiscal_year_start,
                'timezone' => $company->timezone,
                'currency' => $company->currency,
            ],
            'meaning' => [
                'sod_cutoff' => 'Is time ke baad SOD bhara to late gina jayega',
                'eod_cutoff' => 'Is time ke baad EOD bhara to late gina jayega',
                'regularization_days' => 'Employee itne din peeche tak attendance correction maang sakta hai',
                'expense_claim_days' => 'Itne din purana kharcha hi reimbursement mein claim ho sakta hai',
                'notice_period_days' => 'Resignation par last working date isi hisab se apne aap banti hai',
                'policy_gate_enabled' => 'On karo to naya employee saari policies accept karne tak tool nahi khol payega',
                'ticket_sla_enabled' => 'Off rakho to ticket par koi deadline nahi lagegi. On karo to priority ke hisaab se target lagega — sirf office hours ginte hue',
            ],
        ];
    }
}

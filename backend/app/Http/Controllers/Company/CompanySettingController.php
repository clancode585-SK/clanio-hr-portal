<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\CompanySettingRequest;
use App\Models\Company;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use App\Support\TransferWindow;
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

    public function payroll(): JsonResponse
    {
        return ApiResponse::success($this->payrollPayload($this->company()), 'Payroll settings fetched successfully');
    }

    public function updatePayroll(Request $request): JsonResponse
    {
        $company = $this->company();

        $data = $request->validate([
            'salary_pay_day' => ['nullable', 'integer', 'min:1', 'max:28'],
            'salary_pay_time' => ['nullable', 'date_format:H:i'],
            'payroll_review_day' => ['nullable', 'integer', 'min:1', 'max:28'],
            'transfer_otp_enabled' => ['nullable', 'boolean'],
            'transfer_otp_to' => ['nullable', 'in:admin,account'],
            'transfer_early_block' => ['nullable', 'boolean'],
            'gratuity_enabled' => ['nullable', 'boolean'],
            'encashment_enabled' => ['nullable', 'boolean'],
            'notice_recovery_basis' => ['nullable', 'in:basic,gross'],
        ], [
            'salary_pay_day.max' => 'Pay day 1 se 28 ke beech rakho — mahine ke aakhir me date badal jaati hai.',
            'salary_pay_time.date_format' => 'Time aise do — 10:00',
        ]);

        $data = array_filter($data, static fn ($value): bool => $value !== null);

        if ($data === []) {
            throw new ApiException('Badalne ke liye kuch bheja hi nahi.', 422, 'NOTHING_TO_UPDATE');
        }

        if (isset($data['salary_pay_time'])) {
            $data['salary_pay_time'] = $data['salary_pay_time'] . ':00';
        }

        if (isset($data['payroll_review_day'], $data['salary_pay_day'])
            && (int) $data['payroll_review_day'] > (int) $data['salary_pay_day'] + 20) {
            throw new ApiException('Review day aur pay day ke beech itna fasla theek nahi.', 422, 'DAYS_APART');
        }

        $company->forceFill($data + ['updated_by' => $request->user()->id])->save();

        TenantCache::flush(TenantCache::COMPANIES);
        TransferWindow::forget();

        return ApiResponse::success(
            $this->payrollPayload($company->refresh()),
            'Payroll settings update ho gayi'
        );
    }

    private function payrollPayload(Company $company): array
    {
        return [
            'company_id' => (int) $company->id,
            'settings' => [
                'salary_pay_day' => (int) $company->salary_pay_day,
                'salary_pay_time' => substr((string) $company->salary_pay_time, 0, 5),
                'payroll_review_day' => (int) $company->payroll_review_day,
                'transfer_otp_enabled' => (bool) $company->transfer_otp_enabled,
                'transfer_otp_to' => (string) $company->transfer_otp_to,
                'transfer_early_block' => (bool) $company->transfer_early_block,
                'gratuity_enabled' => (bool) $company->gratuity_enabled,
                'encashment_enabled' => (bool) $company->encashment_enabled,
                'notice_recovery_basis' => (string) $company->notice_recovery_basis,
            ],
            'meaning' => [
                'salary_pay_day' => 'Is tarikh ko salary account se katti hai',
                'salary_pay_time' => 'Us din is time se transfer shuru hota hai',
                'payroll_review_day' => 'Is tarikh ke baad HR sabki salary check karke approve karti hai',
                'transfer_otp_enabled' => 'On rakho to paisa bhejne se pehle email par aaya code daalna padega',
                'transfer_otp_to' => 'Code kahan jaaye — admin ke email par ya bank account ke registered email par',
                'transfer_early_block' => 'On rakho to pay date se pehle transfer nahi hoga, chahe approve ho gaya ho',
                'gratuity_enabled' => 'Off hai to FnF me gratuity ki line nahi aayegi',
                'encashment_enabled' => 'Off hai to FnF me bachi hui chhutti ka paisa nahi jodega',
                'notice_recovery_basis' => 'Notice shortfall ka hisaab basic par ya poore gross par',
            ],
        ];
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
                'geo_fence_mode' => $company->geo_fence_mode,
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
                'geo_fence_mode' => 'off — location sirf save hoti hai · flag — office se bahar ka punch mark hota hai · block — bahar se punch hi nahi hoga',
                'ticket_sla_enabled' => 'Off rakho to ticket par koi deadline nahi lagegi. On karo to priority ke hisaab se target lagega — sirf office hours ginte hue',
            ],
        ];
    }
}

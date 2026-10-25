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
            throw new ApiException('Nothing was sent to change.', 422, 'NOTHING_TO_UPDATE');
        }

        foreach (['sod_cutoff', 'eod_cutoff'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = substr($data[$field], 0, 5) . ':00';
            }
        }

        $company->forceFill($data + ['updated_by' => $request->user()->id])->save();

        TenantCache::flush(TenantCache::COMPANIES);

        return ApiResponse::success($this->payload($company->refresh()), 'Company settings updated');
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
            'salary_pay_day.max' => 'Keep the pay day between 1 and 28 — the end of the month shifts.',
            'salary_pay_time.date_format' => 'Time aise do — 10:00',
        ]);

        $data = array_filter($data, static fn ($value): bool => $value !== null);

        if ($data === []) {
            throw new ApiException('Nothing was sent to change.', 422, 'NOTHING_TO_UPDATE');
        }

        if (isset($data['salary_pay_time'])) {
            $data['salary_pay_time'] = $data['salary_pay_time'] . ':00';
        }

        if (isset($data['payroll_review_day'], $data['salary_pay_day'])
            && (int) $data['payroll_review_day'] > (int) $data['salary_pay_day'] + 20) {
            throw new ApiException('That is too wide a gap between the review day and the pay day.', 422, 'DAYS_APART');
        }

        $company->forceFill($data + ['updated_by' => $request->user()->id])->save();

        TenantCache::flush(TenantCache::COMPANIES);
        TransferWindow::forget();

        return ApiResponse::success(
            $this->payrollPayload($company->refresh()),
            'Payroll settings updated'
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
                'salary_pay_day' => 'Salary leaves the account on this date',
                'salary_pay_time' => 'Transfers start at this time on that day',
                'payroll_review_day' => 'After this date HR checks and approves everyone\'s salary',
                'transfer_otp_enabled' => 'Keep it on and a code sent to your email is required before money goes out',
                'transfer_otp_to' => 'Code kahan jaaye — admin ke email par ya bank account ke registered email par',
                'transfer_early_block' => 'Keep it on and no transfer happens before the pay date, even after approval',
                'gratuity_enabled' => 'When off, no gratuity line appears in the full and final',
                'encashment_enabled' => 'When off, unused leave is not paid out in the full and final',
                'notice_recovery_basis' => 'Notice shortfall ka hisaab basic par ya poore gross par',
            ],
        ];
    }

    private function company(): Company
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'No company context. If you are a super admin, send the X-Company-Id header.',
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
                'sod_cutoff' => 'A start-of-day report filed after this time counts as late',
                'eod_cutoff' => 'An end-of-day report filed after this time counts as late',
                'regularization_days' => 'How many days back an employee may ask for an attendance correction',
                'expense_claim_days' => 'How old an expense can be and still be claimed',
                'notice_period_days' => 'The last working date on a resignation is worked out from this',
                'policy_gate_enabled' => 'Switch it on and a new employee cannot open the app until they accept every policy',
                'geo_fence_mode' => 'off — the location is only recorded · flag — a punch outside the office is flagged · block — punching from outside is refused',
                'ticket_sla_enabled' => 'Leave it off and tickets carry no deadline. Switch it on and a target is set by priority, counting office hours only',
            ],
        ];
    }
}

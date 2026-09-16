<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollItemLine;
use App\Models\PayrollRun;
use App\Models\SalaryComponent;
use App\Models\User;
use App\Support\Money;
use App\Support\Scopes\CompanyScope;

final class PayslipService
{
    public function html(PayrollItem $item): string
    {
        $item->loadMissing('lines', 'run');

        $company = Company::query()->withoutGlobalScopes()->find($item->company_id);

        if ($company === null) {
            throw new ApiException('Company record nahi mila.', 404, 'NOT_FOUND');
        }

        $lines = $item->lines;

        return view('payroll.payslip', [
            'item' => $item,
            'company' => $company,
            'monthLabel' => $item->run?->monthLabel() ?? '',
            'earnings' => $lines->where('kind', SalaryComponent::EARNING)->values(),
            'deductions' => $lines->where('kind', SalaryComponent::DEDUCTION)
                ->filter(fn (PayrollItemLine $line): bool => (float) $line->amount > 0)
                ->values(),
            'cut' => $lines->contains(fn (PayrollItemLine $line): bool => (float) $line->amount !== (float) $line->full_amount),
            'inWords' => Money::inWords($item->net_payable),
            'rupee' => fn (float|int|string|null $value): string => '₹' . Money::indian($value, 2),
            'days' => fn (float|int|string|null $value): string => rtrim(rtrim(number_format((float) $value, 1, '.', ''), '0'), '.'),
        ])->render();
    }

    public function fileName(PayrollItem $item): string
    {
        $month = $item->run?->month ?? 'payslip';

        return 'Payslip-' . $item->employee_code . '-' . $month . '.html';
    }

    public function assertReadable(PayrollItem $item, User $actor): void
    {
        $run = $item->run;

        if ($run === null || ! in_array($run->status, [PayrollRun::APPROVED, PayrollRun::PAID], true)) {
            if (! $actor->hasPermission(PayrollRun::VIEW_PERMISSION)) {
                throw new ApiException('Ye payslip abhi release nahi hui.', 403, 'PAYSLIP_NOT_RELEASED');
            }
        }

        if ($actor->hasPermission(PayrollRun::VIEW_PERMISSION) || $actor->isSuperAdmin()) {
            return;
        }

        $employee = Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $actor->company_id)
            ->where('user_id', $actor->id)
            ->first();

        if ($employee === null || (int) $employee->id !== (int) $item->employee_id) {
            throw new ApiException('Ye payslip aapki nahi hai.', 403, 'PAYSLIP_NOT_YOURS');
        }
    }
}

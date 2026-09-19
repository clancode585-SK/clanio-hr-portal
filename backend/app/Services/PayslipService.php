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
use App\Models\SalaryStructure;
use App\Models\User;
use App\Support\Money;
use App\Support\Pdf;
use App\Support\Scopes\CompanyScope;
use App\Support\TaxMath;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

final class PayslipService
{
    public const ADVANCE_CODE = 'ADVANCE';

    public function pdf(PayrollItem $item): string
    {
        return Pdf::bytes('payroll.payslip', $this->data($item));
    }

    public function data(PayrollItem $item): array
    {
        $item->loadMissing('lines', 'run');

        $company = Company::query()->withoutGlobalScopes()->find($item->company_id);

        if ($company === null) {
            throw new ApiException('Company record nahi mila.', 404, 'NOT_FOUND');
        }

        $lines = $item->lines;
        $employee = Employee::query()->withoutGlobalScopes()->find($item->employee_id);

        $deductions = $lines->where('kind', SalaryComponent::DEDUCTION)
            ->filter(fn (PayrollItemLine $line): bool => (float) $line->amount > 0)
            ->values();

        // Advance recovery upar summary strip me alag dikhta hai, deduction table me nahi
        $advance = (float) $deductions->where('code', self::ADVANCE_CODE)->sum('amount');
        $deductions = $deductions->where('code', '!=', self::ADVANCE_CODE)->values();
        $deductionTotal = round((float) $item->total_deductions - $advance, 2);

        return [
            'item' => $item,
            'company' => $company,
            'employee' => $employee,
            'profile' => $this->profile($employee),
            'monthLabel' => $item->run?->monthLabel() ?? '',
            'earnings' => $lines->where('kind', SalaryComponent::EARNING)->values(),
            'deductions' => $deductions,
            'deductionTotal' => $deductionTotal,
            'advance' => $advance,
            'cut' => $lines->contains(fn (PayrollItemLine $line): bool => (float) $line->amount !== (float) $line->full_amount),
            'inWords' => Money::inWords($item->net_payable),
            'tax' => $this->taxFor($item, $company),
            'money' => fn (float|int|string|null $value): string => Money::indian($value, 0),
            'rupee' => fn (float|int|string|null $value): string => Money::indian($value, 2),
            'days' => fn (float|int|string|null $value): string => rtrim(rtrim(number_format((float) $value, 1, '.', ''), '0'), '.'),
        ];
    }

    /** Department designation ke through aata hai, bank primary account se */
    private function profile(?Employee $employee): array
    {
        $blank = ['department' => null, 'bank_name' => null, 'account_number' => null, 'ifsc_code' => null];

        if ($employee === null) {
            return $blank;
        }

        $department = DB::table('designations as d')
            ->join('departments as dept', 'dept.id', '=', 'd.department_id')
            ->where('d.id', $employee->designation_id)
            ->value('dept.name');

        $bank = DB::table('employee_bank_accounts')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->where('is_primary', 1)
            ->first(['bank_name', 'account_number', 'ifsc_code']);

        return [
            'department' => $department,
            'bank_name' => $bank?->bank_name,
            'account_number' => $bank?->account_number,
            'ifsc_code' => $bank?->ifsc_code,
        ];
    }

    /**
     * Payslip ka doosra page — saal bhar ka taxable income, net taxable,
     * tax aur har mahine ka TDS. Company ne TDS off rakha ho to page nahi banta.
     */
    private function taxFor(PayrollItem $item, Company $company): ?array
    {
        if (! $company->tds_enabled || $item->run === null) {
            return null;
        }

        $structure = SalaryStructure::query()
            ->withoutGlobalScopes()
            ->with('lines')
            ->find($item->structure_id);

        if ($structure === null) {
            return null;
        }

        $on = Carbon::parse($item->run->month . '-01');
        $employee = Employee::query()->withoutGlobalScopes()->find($item->employee_id);

        // Beech saal joda ya chhoda — utne hi mahine ki salary jodni hai
        $months = TaxMath::payableMonths(
            $employee?->date_of_joining === null ? null : Carbon::parse($employee->date_of_joining),
            $employee?->exit_date === null ? null : Carbon::parse($employee->exit_date),
            $on
        );

        if ($months <= 0) {
            return null;
        }

        $rows = [];
        $annualTaxable = 0.0;

        foreach ($structure->lines as $line) {
            if ($line->kind !== SalaryComponent::EARNING) {
                continue;
            }

            $gross = round((float) $line->monthly_amount * $months, 2);

            if ($gross <= 0) {
                continue;
            }

            $taxable = $line->is_taxable ? $gross : 0.0;
            $annualTaxable += $taxable;

            $rows[] = [
                'name' => $line->name,
                'gross' => $gross,
                'exempted' => round($gross - $taxable, 2),
                'taxable' => $taxable,
            ];
        }

        if ($rows === []) {
            return null;
        }

        $paidBefore = $this->tdsPaidBefore((int) $item->employee_id, $on);
        $plan = TaxMath::project(round($annualTaxable, 2), $paidBefore, $on);
        $thisMonth = $item->lines->firstWhere('code', SalaryComponent::TDS);

        return [
            'rows' => $rows,
            'annual_taxable_salary' => $plan['annual_taxable_salary'],
            'standard_deduction' => $plan['standard_deduction'],
            'net_taxable_income' => $plan['net_taxable_income'],
            'tax_on_income' => $plan['tax_before_rebate'],
            'rebate' => $plan['rebate'],
            'cess' => $plan['cess'],
            'annual_tax' => $plan['annual_tax'],
            'deducted_till_date' => $plan['deducted_till_date'],
            'remaining_tax' => $plan['remaining_tax'],
            'months_left' => $plan['months_left'],
            'this_month' => $thisMonth === null ? 0.0 : (float) $thisMonth->amount,
            'financial_year' => $plan['financial_year'],
            'months' => $this->monthGrid((int) $item->employee_id, $on, $plan['monthly_tds']),
        ];
    }

    /** Guzre mahine ka asli TDS, aage ka projected — projected par star lagta hai */
    private function monthGrid(int $employeeId, Carbon $on, float $projected): array
    {
        $fyStart = $on->month >= 4 ? $on->year : $on->year - 1;
        $cursor = Carbon::create($fyStart, 4, 1);

        $paid = DB::table('payroll_item_lines as l')
            ->join('payroll_items as i', 'i.id', '=', 'l.item_id')
            ->join('payroll_runs as r', 'r.id', '=', 'i.run_id')
            ->where('i.employee_id', $employeeId)
            ->where('l.code', SalaryComponent::TDS)
            ->whereIn('r.status', [PayrollRun::APPROVED, PayrollRun::PAID])
            ->groupBy('r.month')
            ->pluck(DB::raw('SUM(l.amount) as total'), 'r.month');

        $grid = [];

        for ($i = 0; $i < 12; $i++) {
            $key = $cursor->format('Y-m');
            $done = $key <= $on->format('Y-m');

            $grid[] = [
                'label' => $cursor->format('F Y'),
                'amount' => $done ? (float) ($paid[$key] ?? 0) : $projected,
                'projected' => ! $done,
            ];

            $cursor->addMonthNoOverflow();
        }

        return $grid;
    }

    private function tdsPaidBefore(int $employeeId, Carbon $on): float
    {
        $fyStart = ($on->month >= 4 ? $on->year : $on->year - 1) . '-04';

        return (float) DB::table('payroll_item_lines as l')
            ->join('payroll_items as i', 'i.id', '=', 'l.item_id')
            ->join('payroll_runs as r', 'r.id', '=', 'i.run_id')
            ->where('i.employee_id', $employeeId)
            ->where('l.code', SalaryComponent::TDS)
            ->where('r.month', '>=', $fyStart)
            ->where('r.month', '<', $on->format('Y-m'))
            ->whereIn('r.status', [PayrollRun::APPROVED, PayrollRun::PAID])
            ->sum('l.amount');
    }

    public function fileName(PayrollItem $item): string
    {
        $month = $item->run?->month ?? 'payslip';

        return 'Payslip-' . $item->employee_code . '-' . $month . '.pdf';
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

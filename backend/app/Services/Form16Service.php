<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\SalaryComponent;
use App\Support\Pdf;
use App\Support\TaxMath;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class Form16Service
{
    /**
     * Part B — Income Tax Rules ka statutory layout (Annexure I, point 1 se 21).
     * Part A TRACES se aata hai, wo yahan nahi banta.
     */
    public function build(Employee $employee, int $fyStart): array
    {
        $company = Company::query()->withoutGlobalScopes()->findOrFail($employee->company_id);
        $months = $this->fyMonths($fyStart);

        $runs = PayrollRun::query()
            ->withoutGlobalScopes()
            ->where('company_id', $employee->company_id)
            ->whereIn('month', $months)
            ->whereIn('status', [PayrollRun::APPROVED, PayrollRun::PAID])
            ->pluck('id', 'month');

        if ($runs->isEmpty()) {
            throw new ApiException(
                'Is financial year ka koi approved payroll nahi mila.',
                404,
                'NO_APPROVED_PAYROLL'
            );
        }

        $items = DB::table('payroll_items')
            ->whereIn('run_id', $runs->values())
            ->where('employee_id', $employee->id)
            ->get(['id', 'run_id', 'employee_name', 'designation', 'pan_number']);

        if ($items->isEmpty()) {
            throw new ApiException('Is employee ki koi payslip nahi mili.', 404, 'NO_PAYSLIPS');
        }

        // is_taxable payroll line par nahi hota — component master se aata hai
        $taxableByCode = DB::table('salary_components')
            ->where('company_id', $employee->company_id)
            ->pluck('is_taxable', 'code')
            ->map(fn ($value): bool => (bool) $value)
            ->all();

        $lines = DB::table('payroll_item_lines')
            ->whereIn('item_id', $items->pluck('id'))
            ->get(['item_id', 'code', 'kind', 'name', 'amount', 'is_statutory']);

        $salary17 = 0.0;      // 1(a) — section 17(1), saara salary
        $exempt10 = 0.0;      // 2 — section 10 ke exempt allowance
        $exemptRows = [];
        $professionalTax = 0.0;
        $tdsDeducted = 0.0;
        $monthsPaid = 0;

        $byItem = [];

        foreach ($lines as $line) {
            $byItem[(int) $line->item_id][] = $line;
        }

        foreach ($items as $item) {
            $monthsPaid++;

            foreach ($byItem[(int) $item->id] ?? [] as $row) {
                $amount = (float) $row->amount;

                if ($row->kind === SalaryComponent::EARNING) {
                    $salary17 += $amount;

                    // Jo component taxable nahi hai wo section 10 ki chhoot hai
                    if (($taxableByCode[$row->code] ?? true) === false) {
                        $exempt10 += $amount;
                        $exemptRows[$row->name] = ($exemptRows[$row->name] ?? 0) + $amount;
                    }

                    continue;
                }

                if ($row->code === SalaryComponent::PROFESSIONAL_TAX) {
                    $professionalTax += $amount;
                }

                if ($row->code === SalaryComponent::TDS) {
                    $tdsDeducted += $amount;
                }
            }
        }

        $salary17 = round($salary17, 2);
        $exempt10 = round($exempt10, 2);
        $professionalTax = round($professionalTax, 2);

        $fromCurrentEmployer = round($salary17 - $exempt10, 2);
        $standard = TaxMath::STANDARD_DEDUCTION;
        $section16Total = round($standard + $professionalTax, 2);
        $chargeable = round(max(0.0, $fromCurrentEmployer - $section16Total), 2);

        $grossTotal = $chargeable;
        $chapterVi = 0.0;
        $taxableIncome = round(max(0.0, $grossTotal - $chapterVi), 2);

        $tax = TaxMath::taxOn($taxableIncome);
        $payable = round($tax['total'], 2);

        return [
            'company' => $company,
            'employee' => $employee,
            'employee_name' => $items->first()->employee_name,
            'designation' => $items->first()->designation,
            'pan' => $items->first()->pan_number,
            'financial_year' => $fyStart . '-' . substr((string) ($fyStart + 1), 2),
            'assessment_year' => ($fyStart + 1) . '-' . substr((string) ($fyStart + 2), 2),
            'period' => $this->period($employee, $fyStart),
            'months_paid' => $monthsPaid,
            'opted_out_115bac' => 'No',

            // Annexure I ke numbered points
            'salary_17_1' => $salary17,
            'perquisites_17_2' => 0.0,
            'profits_17_3' => 0.0,
            'gross_total_1d' => $salary17,
            'other_employer_1e' => 0.0,
            'exempt_rows' => $exemptRows,
            'exempt_total_2i' => $exempt10,
            'from_employer_3' => $fromCurrentEmployer,
            'standard_deduction_4a' => $standard,
            'entertainment_4b' => 0.0,
            'employment_tax_4c' => $professionalTax,
            'section16_total_5' => $section16Total,
            'chargeable_6' => $chargeable,
            'house_property_7a' => 0.0,
            'other_sources_7b' => 0.0,
            'other_income_8' => 0.0,
            'gross_total_income_9' => $grossTotal,
            'chapter_via_11' => $chapterVi,
            'taxable_income_12' => $taxableIncome,
            'tax_on_income_13' => $tax['tax_before_rebate'],
            'rebate_87a_14' => $tax['rebate'],
            'surcharge_15' => 0.0,
            'cess_16' => $tax['cess'],
            'tax_payable_17' => $payable,
            'relief_89_18' => 0.0,
            'tds_12baa_19' => 0.0,
            'tcs_12baa_20' => 0.0,
            'net_tax_payable_21' => $payable,

            'tds_deducted' => round($tdsDeducted, 2),
            'balance' => round($payable - $tdsDeducted, 2),
        ];
    }

    public function pdf(Employee $employee, int $fyStart): string
    {
        return Pdf::bytes('payroll.form16', $this->build($employee, $fyStart));
    }

    /** Us FY me jinki koi approved payslip hai — unki list */
    public function employeesFor(int $companyId, int $fyStart)
    {
        $runs = PayrollRun::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereIn('month', $this->fyMonths($fyStart))
            ->whereIn('status', [PayrollRun::APPROVED, PayrollRun::PAID])
            ->pluck('id');

        if ($runs->isEmpty()) {
            return collect();
        }

        $ids = DB::table('payroll_items')
            ->whereIn('run_id', $runs)
            ->distinct()
            ->pluck('employee_id');

        return Employee::query()
            ->withoutGlobalScopes()
            ->whereIn('id', $ids)
            ->orderBy('employee_code')
            ->get();
    }

    /** Saal ka register — kiska Form 16 banega, kiska salary certificate */
    public function register(int $companyId, int $fyStart): array
    {
        $rows = [];

        foreach ($this->employeesFor($companyId, $fyStart) as $employee) {
            try {
                $d = $this->build($employee, $fyStart);
            } catch (ApiException) {
                continue;
            }

            $rows[] = [
                'uuid' => $employee->uuid,
                'employee_code' => $employee->employee_code,
                'name' => $d['employee_name'],
                'pan' => $d['pan'],
                'from' => $d['period']['from'],
                'to' => $d['period']['to'],
                'months' => $d['months_paid'],
                'gross' => $d['gross_total_1d'],
                'taxable' => $d['taxable_income_12'],
                'tax' => $d['net_tax_payable_21'],
                'tds' => $d['tds_deducted'],
                // TDS 0 hai to kanoonan Form 16 dena zaroori nahi
                'document' => $d['tds_deducted'] > 0 ? 'Form 16 Part B' : 'Salary certificate',
            ];
        }

        return $rows;
    }

    /** Sabka Part B ek hi PDF me — har employee naye page par */
    public function bulkPdf(int $companyId, int $fyStart, bool $onlyWithTds = false): array
    {
        $parts = [];
        $made = 0;
        $skipped = [];

        foreach ($this->employeesFor($companyId, $fyStart) as $employee) {
            try {
                $data = $this->build($employee, $fyStart);
            } catch (ApiException $caught) {
                $skipped[] = $employee->employee_code . ' — ' . $caught->getMessage();

                continue;
            }

            if ($onlyWithTds && $data['tds_deducted'] <= 0) {
                $skipped[] = $employee->employee_code . ' — TDS 0, Form 16 zaroori nahi';

                continue;
            }

            $parts[] = view('payroll.form16', $data)->render();
            $made++;
        }

        return [
            'pdf' => Pdf::fromHtml($this->stitch($parts)),
            'made' => $made,
            'skipped' => $skipped,
        ];
    }

    /** Har letter ka body nikaal kar ek page me jodte hain */
    private function stitch(array $parts): string
    {
        if ($parts === []) {
            return '<!DOCTYPE html><html><body><p>Is saal ka koi Form 16 nahi bana.</p></body></html>';
        }

        $first = $parts[0];
        $head = substr($first, 0, strpos($first, '<body>') + 6);
        $bodies = [];

        foreach ($parts as $index => $part) {
            $start = strpos($part, '<body>') + 6;
            $end = strrpos($part, '</body>');
            $inner = substr($part, $start, $end - $start);

            $bodies[] = $index === 0
                ? $inner
                : '<div style="page-break-before:always"></div>' . $inner;
        }

        return $head . implode("\n", $bodies) . '</body></html>';
    }

    public function fileName(Employee $employee, int $fyStart): string
    {
        return 'Form16B-' . $employee->employee_code . '-' . $fyStart . '-'
            . substr((string) ($fyStart + 1), 2) . '.pdf';
    }

    /** Period with the Employer — joining ya FY start, jo baad me ho */
    private function period(Employee $employee, int $fyStart): array
    {
        $fyFrom = Carbon::create($fyStart, 4, 1);
        $fyTo = Carbon::create($fyStart + 1, 3, 31);

        $joined = $employee->date_of_joining === null ? null : Carbon::parse($employee->date_of_joining);
        $left = $employee->exit_date === null ? null : Carbon::parse($employee->exit_date);

        $from = $joined !== null && $joined->greaterThan($fyFrom) ? $joined : $fyFrom;
        $to = $left !== null && $left->lessThan($fyTo) ? $left : $fyTo;

        return [
            'from' => $from->format('d-M-Y'),
            'to' => $to->format('d-M-Y'),
        ];
    }

    /** @return string[] */
    private function fyMonths(int $fyStart): array
    {
        $cursor = Carbon::create($fyStart, 4, 1);
        $months = [];

        for ($i = 0; $i < 12; $i++) {
            $months[] = $cursor->format('Y-m');
            $cursor->addMonthNoOverflow();
        }

        return $months;
    }
}

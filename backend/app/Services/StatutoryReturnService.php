<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\PayrollRun;
use App\Models\SalaryComponent;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class StatutoryReturnService
{
    public const ECR_SEPARATOR = '#~#';

    /** EPFO ka ECR — 11 field, #~# se alag, ek line per member */
    public function ecr(int $companyId, string $month): array
    {
        $company = $this->company($companyId);
        $items = $this->items($companyId, $month);

        $epsPercent = (float) $company->eps_percent;
        $epsCeiling = (float) $company->eps_wage_ceiling;
        $pfCeiling = (float) $company->pf_wage_ceiling;

        $lines = [];
        $skipped = [];
        $totals = ['epf' => 0.0, 'eps' => 0.0, 'diff' => 0.0, 'members' => 0];

        foreach ($items as $item) {
            if (! $item->has_pf_account) {
                continue;
            }

            if (blank($item->uan_number)) {
                $skipped[] = $item->employee_code . ' — UAN nahi hai';

                continue;
            }

            $basic = $this->lineAmount($item->id, SalaryComponent::BASIC);
            $epfWages = $pfCeiling > 0 ? min($basic, $pfCeiling) : $basic;
            $epsWages = $epsCeiling > 0 ? min($basic, $epsCeiling) : $basic;

            $epfContribution = round($this->lineAmount($item->id, SalaryComponent::PF_EMPLOYEE), 0);
            $employerTotal = round($this->lineAmount($item->id, SalaryComponent::PF_EMPLOYER), 0);
            $epsContribution = round($epsWages * $epsPercent / 100, 0);
            $diff = round($employerTotal - $epsContribution, 0);

            if ($diff < 0) {
                $epsContribution = $employerTotal;
                $diff = 0.0;
            }

            $lines[] = implode(self::ECR_SEPARATOR, [
                $item->uan_number,
                $this->clean($item->employee_name),
                (int) round((float) $item->gross_earnings),
                (int) round($epfWages),
                (int) round($epsWages),
                (int) round($epfWages),
                (int) $epfContribution,
                (int) $epsContribution,
                (int) $diff,
                (int) round((float) $item->lop_days),
                0,
            ]);

            $totals['epf'] += $epfContribution;
            $totals['eps'] += $epsContribution;
            $totals['diff'] += $diff;
            $totals['members']++;
        }

        return [
            'title' => 'PF ECR',
            'period' => $month,
            'format' => 'txt',
            'file_name' => 'ECR-' . ($company->pf_establishment_code ?: 'PF') . '-' . $month . '.txt',
            'content' => implode("\n", $lines),
            'lines' => $lines,
            'row_count' => count($lines),
            'skipped' => $skipped,
            'totals' => [
                'members' => $totals['members'],
                'epf_employee' => round($totals['epf'], 2),
                'eps_employer' => round($totals['eps'], 2),
                'epf_employer' => round($totals['diff'], 2),
                'total_remitted' => round($totals['epf'] + $totals['eps'] + $totals['diff'], 2),
            ],
            'establishment_code' => $company->pf_establishment_code,
        ];
    }

    /** ESIC ka monthly contribution file */
    public function esi(int $companyId, string $month): array
    {
        $company = $this->company($companyId);
        $items = $this->items($companyId, $month);

        $rows = [];
        $skipped = [];
        $total = 0.0;

        foreach ($items as $item) {
            $employee = $this->lineAmount($item->id, SalaryComponent::ESI_EMPLOYEE);
            $employer = $this->lineAmount($item->id, SalaryComponent::ESI_EMPLOYER);

            if ($employee <= 0 && $employer <= 0) {
                continue;
            }

            if (blank($item->esic_number)) {
                $skipped[] = $item->employee_code . ' — ESIC number nahi hai';

                continue;
            }

            $paidDays = (int) round((float) $item->paid_days);

            $rows[] = [
                $item->esic_number,
                $this->clean($item->employee_name),
                $paidDays,
                (int) round((float) $item->gross_earnings),
                $paidDays === 0 ? '2' : '',
                '',
            ];

            $total += $employee + $employer;
        }

        return [
            'title' => 'ESI Monthly Contribution',
            'period' => $month,
            'format' => 'csv',
            'file_name' => 'ESI-' . ($company->esi_establishment_code ?: 'ESIC') . '-' . $month . '.csv',
            'columns' => [
                'IP Number', 'IP Name', 'No of Days for which wages paid',
                'Total Monthly Wages', 'Reason Code for Zero workings days', 'Last Working Day',
            ],
            'rows' => $rows,
            'row_count' => count($rows),
            'skipped' => $skipped,
            'totals' => ['contribution' => round($total, 2)],
            'establishment_code' => $company->esi_establishment_code,
        ];
    }

    /** Form 24Q Annexure I — quarter ke har mahine ki deductee detail */
    public function tds24q(int $companyId, string $quarter, int $year): array
    {
        $months = $this->quarterMonths($quarter, $year);
        $company = $this->company($companyId);

        $rows = [];
        $total = 0.0;

        foreach ($months as $month) {
            $run = PayrollRun::query()
                ->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('month', $month)
                ->whereIn('status', [PayrollRun::APPROVED, PayrollRun::PAID])
                ->first(['id', 'pay_date']);

            if ($run === null) {
                continue;
            }

            $items = DB::table('payroll_items as i')
                ->join('employees as e', 'e.id', '=', 'i.employee_id')
                ->where('i.run_id', $run->id)
                ->orderBy('i.employee_code')
                ->get(['i.id', 'i.employee_code', 'i.employee_name', 'i.gross_earnings', 'e.pan_number']);

            foreach ($items as $item) {
                $tds = $this->lineAmount((int) $item->id, SalaryComponent::TDS);

                if ($tds <= 0) {
                    continue;
                }

                $rows[] = [
                    $month,
                    $item->employee_code,
                    $this->clean($item->employee_name),
                    $item->pan_number ?: 'PANNOTAVBL',
                    '192B',
                    $run->pay_date,
                    round((float) $item->gross_earnings, 2),
                    round($tds, 2),
                    round($tds, 2),
                ];

                $total += $tds;
            }
        }

        return [
            'title' => 'Form 24Q Annexure I',
            'period' => $quarter . ' ' . $year,
            'format' => 'csv',
            'file_name' => '24Q-' . $quarter . '-' . $year . '.csv',
            'columns' => [
                'Month', 'Employee code', 'Deductee name', 'PAN', 'Section',
                'Date of payment', 'Amount paid', 'TDS deducted', 'TDS deposited',
            ],
            'rows' => $rows,
            'row_count' => count($rows),
            'skipped' => [],
            'totals' => ['tds' => round($total, 2)],
            'establishment_code' => $company->tan_number,
        ];
    }

    private function quarterMonths(string $quarter, int $year): array
    {
        // Financial year — Q1 April se
        $start = match (strtoupper($quarter)) {
            'Q1' => [$year, 4],
            'Q2' => [$year, 7],
            'Q3' => [$year, 10],
            'Q4' => [$year + 1, 1],
            default => throw new ApiException('Quarter Q1 se Q4 me do.', 422, 'QUARTER_INVALID'),
        };

        $cursor = Carbon::create($start[0], $start[1], 1);

        return [
            $cursor->format('Y-m'),
            $cursor->copy()->addMonthNoOverflow()->format('Y-m'),
            $cursor->copy()->addMonthsNoOverflow(2)->format('Y-m'),
        ];
    }

    private function company(int $companyId): Company
    {
        return Company::query()->withoutGlobalScopes()->findOrFail($companyId);
    }

    private function items(int $companyId, string $month)
    {
        $run = PayrollRun::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('month', $month)
            ->first(['id', 'status']);

        if ($run === null) {
            throw new ApiException('Is mahine ka payroll nahi chala.', 404, 'RUN_NOT_FOUND');
        }

        if (! in_array($run->status, [PayrollRun::APPROVED, PayrollRun::PAID], true)) {
            throw new ApiException(
                'Ye payroll abhi approve nahi hua — return approve hone ke baad hi banta hai.',
                409,
                'RUN_NOT_APPROVED'
            );
        }

        $items = DB::table('payroll_items as i')
            ->join('employees as e', 'e.id', '=', 'i.employee_id')
            ->where('i.run_id', $run->id)
            ->orderBy('i.employee_code')
            ->get([
                'i.id', 'i.employee_code', 'i.employee_name', 'i.gross_earnings',
                'i.lop_days', 'i.paid_days',
                'e.uan_number', 'e.esic_number', 'e.has_pf_account',
            ]);

        $this->prefetchLines($items->pluck('id')->all());

        return $items;
    }

    private array $lineCache = [];

    private function prefetchLines(array $itemIds): void
    {
        $this->lineCache = [];

        if ($itemIds === []) {
            return;
        }

        $rows = DB::table('payroll_item_lines')
            ->whereIn('item_id', $itemIds)
            ->get(['item_id', 'code', 'amount']);

        foreach ($rows as $row) {
            $this->lineCache[(int) $row->item_id][$row->code] = (float) $row->amount;
        }
    }

    private function lineAmount(int $itemId, string $code): float
    {
        if (array_key_exists($itemId, $this->lineCache)) {
            return $this->lineCache[$itemId][$code] ?? 0.0;
        }

        return (float) DB::table('payroll_item_lines')
            ->where('item_id', $itemId)
            ->where('code', $code)
            ->value('amount');
    }

    // ECR portal special characters par reject karta hai
    private function clean(string $value): string
    {
        return trim(preg_replace('/[^A-Za-z0-9 .]/', '', $value) ?? $value);
    }
}

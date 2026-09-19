<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Attendance;
use App\Models\ExpenseClaim;
use App\Models\SalaryAdvance;
use App\Models\SalaryComponent;
use App\Support\ReportCatalog;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function build(int $companyId, string $key, array $params): array
    {
        if (! ReportCatalog::has($key)) {
            throw new ApiException('Ye report nahi mili.', 404, 'REPORT_UNKNOWN');
        }

        return match ($key) {
            'attendance-register' => $this->attendanceRegister($companyId, $this->month($params)),
            'payroll-register' => $this->payrollRegister($companyId, $this->month($params)),
            'bank-transfer' => $this->bankTransfer($companyId, $this->month($params)),
            'pf-esi' => $this->pfEsi($companyId, $this->month($params)),
            'advance-register' => $this->advanceRegister($companyId),
            'form16-register' => $this->form16Register($companyId, $this->fy($params)),
            'leave-balance' => $this->leaveBalance($companyId, $this->year($params)),
            'employee-master' => $this->employeeMaster($companyId),
            'expense-payout' => $this->expensePayout($companyId, ...$this->range($params)),
        };
    }

    private function month(array $params): string
    {
        $month = (string) ($params['month'] ?? '');

        if (! preg_match('/^\d{4}-\d{2}$/', $month)) {
            throw new ApiException('Mahina YYYY-MM me do.', 422, 'MONTH_REQUIRED');
        }

        return $month;
    }

    private function year(array $params): int
    {
        $year = (int) ($params['year'] ?? 0);

        if ($year < 2000 || $year > 2100) {
            throw new ApiException('Saal sahi nahi hai.', 422, 'YEAR_REQUIRED');
        }

        return $year;
    }

    private function range(array $params): array
    {
        $from = (string) ($params['from'] ?? '');
        $to = (string) ($params['to'] ?? '');

        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            throw new ApiException('From aur to date YYYY-MM-DD me do.', 422, 'RANGE_REQUIRED');
        }

        if ($from > $to) {
            throw new ApiException('From date, to date se baad ki hai.', 422, 'RANGE_INVALID');
        }

        return [$from, $to];
    }

    private function attendanceRegister(int $companyId, string $month): array
    {
        $start = Carbon::parse($month . '-01')->startOfMonth();
        $days = $start->daysInMonth;

        $employees = DB::table('employees as e')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->where('e.company_id', $companyId)
            ->where('e.is_active', 1)
            ->orderBy('e.employee_code')
            ->get(['e.id', 'e.employee_code', 'u.name']);

        $rows = DB::table('attendances')
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->whereBetween('attendance_date', [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()])
            ->get(['employee_id', 'attendance_date', 'status']);

        $grid = [];

        foreach ($rows as $row) {
            $grid[(int) $row->employee_id][(int) Carbon::parse($row->attendance_date)->day] = $this->mark($row->status);
        }

        $columns = ['Code', 'Name'];

        for ($d = 1; $d <= $days; $d++) {
            $columns[] = (string) $d;
        }

        $columns = array_merge($columns, ['Present', 'Absent', 'Half day', 'Leave']);

        $out = [];

        foreach ($employees as $employee) {
            $line = [$employee->employee_code, $employee->name];
            $tally = ['P' => 0, 'A' => 0, 'HD' => 0, 'L' => 0];

            for ($d = 1; $d <= $days; $d++) {
                $mark = $grid[(int) $employee->id][$d] ?? '';
                $line[] = $mark;

                if (isset($tally[$mark])) {
                    $tally[$mark]++;
                }
            }

            $out[] = array_merge($line, [$tally['P'], $tally['A'], $tally['HD'], $tally['L']]);
        }

        return $this->wrap('Attendance Register', $month, $columns, $out);
    }

    private function mark(string $status): string
    {
        return match ($status) {
            Attendance::PRESENT => 'P',
            Attendance::ABSENT => 'A',
            Attendance::HALF_DAY => 'HD',
            Attendance::ON_LEAVE => 'L',
            default => '',
        };
    }

    private function payrollRegister(int $companyId, string $month): array
    {
        $run = DB::table('payroll_runs')
            ->where('company_id', $companyId)
            ->where('month', $month)
            ->first(['id', 'status']);

        if ($run === null) {
            throw new ApiException('Is mahine ka payroll nahi chala.', 404, 'RUN_NOT_FOUND');
        }

        $items = DB::table('payroll_items')
            ->where('run_id', $run->id)
            ->orderBy('employee_code')
            ->get(['id', 'employee_code', 'employee_name', 'designation', 'working_days', 'lop_days', 'paid_days', 'gross_earnings', 'total_deductions', 'net_payable']);

        $lines = DB::table('payroll_item_lines')
            ->whereIn('item_id', $items->pluck('id'))
            ->get(['item_id', 'code', 'name', 'kind', 'amount']);

        $codes = [];

        foreach ($lines as $line) {
            $codes[$line->code] = $line->name;
        }

        ksort($codes);

        $byItem = [];

        foreach ($lines as $line) {
            $byItem[(int) $line->item_id][$line->code] = (float) $line->amount;
        }

        $columns = array_merge(
            ['Code', 'Name', 'Designation', 'Working days', 'LOP days', 'Paid days'],
            array_values($codes),
            ['Gross', 'Deductions', 'Net payable']
        );

        $out = [];

        foreach ($items as $item) {
            $line = [
                $item->employee_code,
                $item->employee_name,
                $item->designation,
                $item->working_days,
                $item->lop_days,
                $item->paid_days,
            ];

            foreach (array_keys($codes) as $code) {
                $line[] = $byItem[(int) $item->id][$code] ?? 0;
            }

            $out[] = array_merge($line, [$item->gross_earnings, $item->total_deductions, $item->net_payable]);
        }

        return $this->wrap('Payroll Register', $month, $columns, $out);
    }

    private function bankTransfer(int $companyId, string $month): array
    {
        $run = DB::table('payroll_runs')
            ->where('company_id', $companyId)
            ->where('month', $month)
            ->first(['id']);

        if ($run === null) {
            throw new ApiException('Is mahine ka payroll nahi chala.', 404, 'RUN_NOT_FOUND');
        }

        $rows = DB::table('payroll_items as i')
            ->leftJoin('employee_bank_accounts as b', function ($join): void {
                $join->on('b.employee_id', '=', 'i.employee_id')
                    ->where('b.is_active', '=', 1)
                    ->where('b.is_primary', '=', 1);
            })
            ->where('i.run_id', $run->id)
            ->where('i.approval_status', 'approved')
            ->orderBy('i.employee_code')
            ->get([
                'i.employee_code', 'i.employee_name', 'i.net_payable', 'i.payment_status',
                'b.account_holder_name', 'b.bank_name', 'b.account_number', 'b.ifsc_code',
            ]);

        $out = [];

        foreach ($rows as $row) {
            $out[] = [
                $row->employee_code,
                $row->employee_name,
                $row->account_holder_name ?? '',
                $row->bank_name ?? '',
                $row->account_number ?? '',
                $row->ifsc_code ?? '',
                (float) $row->net_payable,
                $row->payment_status,
            ];
        }

        return $this->wrap('Bank Transfer Sheet', $month, [
            'Code', 'Name', 'Account holder', 'Bank', 'Account number', 'IFSC', 'Amount', 'Payment status',
        ], $out);
    }

    private function pfEsi(int $companyId, string $month): array
    {
        $run = DB::table('payroll_runs')
            ->where('company_id', $companyId)
            ->where('month', $month)
            ->first(['id']);

        if ($run === null) {
            throw new ApiException('Is mahine ka payroll nahi chala.', 404, 'RUN_NOT_FOUND');
        }

        $items = DB::table('payroll_items as i')
            ->join('employees as e', 'e.id', '=', 'i.employee_id')
            ->where('i.run_id', $run->id)
            ->orderBy('i.employee_code')
            ->get(['i.id', 'i.employee_code', 'i.employee_name', 'i.gross_earnings', 'e.uan_number', 'e.esic_number', 'e.has_pf_account']);

        $wanted = [
            SalaryComponent::BASIC,
            SalaryComponent::PF_EMPLOYEE,
            SalaryComponent::PF_EMPLOYER,
            SalaryComponent::ESI_EMPLOYEE,
            SalaryComponent::ESI_EMPLOYER,
            SalaryComponent::PROFESSIONAL_TAX,
            SalaryComponent::TDS,
        ];

        $lines = DB::table('payroll_item_lines')
            ->whereIn('item_id', $items->pluck('id'))
            ->whereIn('code', $wanted)
            ->get(['item_id', 'code', 'amount']);

        $byItem = [];

        foreach ($lines as $line) {
            $byItem[(int) $line->item_id][$line->code] = (float) $line->amount;
        }

        $out = [];

        foreach ($items as $item) {
            $pick = fn (string $code): float => $byItem[(int) $item->id][$code] ?? 0.0;

            $out[] = [
                $item->employee_code,
                $item->employee_name,
                $item->uan_number ?? '',
                $item->esic_number ?? '',
                $item->has_pf_account ? 'Yes' : 'No',
                $pick(SalaryComponent::BASIC),
                (float) $item->gross_earnings,
                $pick(SalaryComponent::PF_EMPLOYEE),
                $pick(SalaryComponent::PF_EMPLOYER),
                $pick(SalaryComponent::ESI_EMPLOYEE),
                $pick(SalaryComponent::ESI_EMPLOYER),
                $pick(SalaryComponent::PROFESSIONAL_TAX),
                $pick(SalaryComponent::TDS),
            ];
        }

        return $this->wrap('PF / ESI Statement', $month, [
            'Code', 'Name', 'UAN', 'ESIC number', 'Has PF', 'Basic', 'Gross',
            'PF employee', 'PF employer', 'ESI employee', 'ESI employer', 'Professional tax', 'TDS',
        ], $out);
    }

    private function fy(array $params): int
    {
        $fy = (int) ($params['fy'] ?? 0);

        if ($fy < 2000 || $fy > 2100) {
            throw new ApiException('Financial year ka pehla saal do, jaise 2026.', 422, 'FY_REQUIRED');
        }

        return $fy;
    }

    private function form16Register(int $companyId, int $fyStart): array
    {
        $rows = [];

        foreach (app(Form16Service::class)->register($companyId, $fyStart) as $row) {
            $rows[] = [
                $row['employee_code'],
                $row['name'],
                $row['pan'] ?: '',
                $row['from'],
                $row['to'],
                $row['months'],
                $row['gross'],
                $row['taxable'],
                $row['tax'],
                $row['tds'],
                $row['document'],
            ];
        }

        return $this->wrap('Form 16 Register', $fyStart . '-' . substr((string) ($fyStart + 1), 2), [
            'Code', 'Name', 'PAN', 'From', 'To', 'Months',
            'Gross salary', 'Taxable income', 'Tax payable', 'TDS deducted', 'Document',
        ], $rows);
    }

    private function advanceRegister(int $companyId): array
    {
        $rows = DB::table('salary_advances')
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->orderByDesc('id')
            ->get(['reference', 'employee_code', 'employee_name', 'amount', 'emi_amount', 'recovered', 'outstanding', 'status', 'reason', 'disbursed_at', 'closed_at']);

        $out = [];

        foreach ($rows as $row) {
            $out[] = [
                $row->reference,
                $row->employee_code,
                $row->employee_name,
                (float) $row->amount,
                (float) $row->emi_amount,
                (float) $row->recovered,
                (float) $row->outstanding,
                $row->status,
                $row->reason,
                $row->disbursed_at ? Carbon::parse($row->disbursed_at)->toDateString() : '',
                $row->closed_at ? Carbon::parse($row->closed_at)->toDateString() : '',
            ];
        }

        return $this->wrap('Advance Register', null, [
            'Reference', 'Code', 'Name', 'Amount', 'EMI', 'Recovered', 'Outstanding', 'Status', 'Reason', 'Disbursed on', 'Closed on',
        ], $out);
    }

    private function leaveBalance(int $companyId, int $year): array
    {
        $rows = DB::table('leave_balances as b')
            ->join('employees as e', 'e.id', '=', 'b.employee_id')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->join('leave_types as t', 't.id', '=', 'b.leave_type_id')
            ->where('b.company_id', $companyId)
            ->where('b.year', $year)
            ->where('e.is_active', 1)
            ->orderBy('e.employee_code')
            ->orderBy('t.name')
            ->get([
                'e.employee_code', 'u.name', 't.name as leave_type', 't.code as leave_code',
                'b.opening', 'b.accrued', 'b.adjusted', 'b.used', 'b.encashed', 'b.available',
            ]);

        $out = [];

        foreach ($rows as $row) {
            $out[] = [
                $row->employee_code,
                $row->name,
                $row->leave_code,
                $row->leave_type,
                (float) $row->opening,
                (float) $row->accrued,
                (float) $row->adjusted,
                round((float) $row->opening + (float) $row->accrued + (float) $row->adjusted, 2),
                (float) $row->used,
                (float) $row->encashed,
                (float) $row->available,
            ];
        }

        return $this->wrap('Leave Balance', (string) $year, [
            'Code', 'Name', 'Type code', 'Leave type',
            'Opening', 'Accrued', 'Adjusted', 'Entitled', 'Used', 'Encashed', 'Available',
        ], $out);
    }

    private function employeeMaster(int $companyId): array
    {
        $rows = DB::table('employees as e')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->leftJoin('designations as d', 'd.id', '=', 'e.designation_id')
            ->leftJoin('users as m', 'm.id', '=', 'e.reporting_manager_id')
            ->leftJoin('work_shifts as s', 's.id', '=', 'e.work_shift_id')
            ->where('e.company_id', $companyId)
            ->where('e.is_active', 1)
            ->orderBy('e.employee_code')
            ->get([
                'e.employee_code', 'u.name', 'u.email', 'e.personal_phone', 'e.date_of_joining',
                'e.employment_type', 'e.employment_status', 'd.name as designation', 's.name as shift',
                'm.name as manager', 'e.date_of_birth', 'e.father_name', 'e.gender',
                'e.pan_number', 'e.uan_number', 'e.esic_number', 'e.insurer_name', 'e.insurance_number',
            ]);

        $out = [];

        foreach ($rows as $row) {
            $out[] = [
                $row->employee_code, $row->name, $row->email, $row->personal_phone,
                $row->date_of_joining, $row->employment_type, $row->employment_status,
                $row->designation ?? '', $row->shift ?? '', $row->manager ?? '',
                $row->date_of_birth, $row->father_name, $row->gender,
                $row->pan_number ?? '', $row->uan_number ?? '', $row->esic_number ?? '',
                $row->insurer_name ?? '', $row->insurance_number ?? '',
            ];
        }

        return $this->wrap('Employee Master', null, [
            'Code', 'Name', 'Work email', 'Phone', 'Joining date', 'Employment type', 'Status',
            'Designation', 'Shift', 'Reporting manager', 'Date of birth', "Father's name", 'Gender',
            'PAN', 'UAN', 'ESIC number', 'Insurer', 'Policy number',
        ], $out);
    }

    private function expensePayout(int $companyId, string $from, string $to): array
    {
        $rows = DB::table('expense_claims as c')
            ->join('employees as e', 'e.id', '=', 'c.employee_id')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->where('c.company_id', $companyId)
            ->whereBetween('c.expense_date', [$from, $to])
            ->orderBy('c.expense_date')
            ->where('c.is_active', 1)
            ->get([
                'c.uuid', 'e.employee_code', 'u.name', 'c.category', 'c.expense_date',
                'c.amount', 'c.approved_amount', 'c.payable_amount', 'c.status', 'c.purpose',
                'c.paid_on', 'c.payment_mode', 'c.payment_reference',
            ]);

        $out = [];

        foreach ($rows as $row) {
            $out[] = [
                substr((string) $row->uuid, 0, 8),
                $row->employee_code,
                $row->name,
                $row->category,
                $row->expense_date,
                (float) $row->amount,
                $row->approved_amount === null ? '' : (float) $row->approved_amount,
                $row->payable_amount === null ? '' : (float) $row->payable_amount,
                $row->status,
                $row->purpose ?? '',
                $row->paid_on ? Carbon::parse($row->paid_on)->toDateString() : '',
                $row->payment_mode ?? '',
                $row->payment_reference ?? '',
            ];
        }

        return $this->wrap('Expense Payout', $from . ' to ' . $to, [
            'Reference', 'Code', 'Name', 'Category', 'Date', 'Claimed', 'Approved', 'Payable',
            'Status', 'Purpose', 'Paid on', 'Mode', 'Payment reference',
        ], $out);
    }

    private function wrap(string $title, ?string $period, array $columns, array $rows): array
    {
        return [
            'title' => $title,
            'period' => $period,
            'columns' => $columns,
            'rows' => $rows,
            'row_count' => count($rows),
            'generated_at' => Carbon::now()->toIso8601String(),
        ];
    }
}

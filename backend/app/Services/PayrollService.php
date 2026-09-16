<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollItemLine;
use App\Models\PayrollRun;
use App\Models\SalaryComponent;
use App\Models\SalaryStructure;
use App\Models\User;
use App\Support\CompanyTime;
use App\Support\NotificationType;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use App\Support\WorkCalendar;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PayrollService
{
    public function __construct(
        private readonly SalaryStructureService $structures,
        private readonly NotificationService $notifications
    ) {}

    public function open(int $companyId, array $data, User $actor): PayrollRun
    {
        $month = $this->assertMonth($data['month'], $companyId);

        $existing = PayrollRun::query()->where('company_id', $companyId)->where('month', $month)->first();

        if ($existing !== null) {
            throw new ApiException(
                $existing->monthLabel() . ' ka payroll already bana hua hai (' . $existing->statusLabel() . ').',
                409,
                'PAYROLL_ALREADY_OPEN'
            );
        }

        $run = new PayrollRun([
            'month' => $month,
            'pay_date' => $data['pay_date'] ?? $this->defaultPayDate($companyId, $month),
            'note' => $data['note'] ?? null,
        ]);

        $run->company_id = $companyId;
        $run->created_by = $actor->id;
        $run->save();

        $this->flush();

        return $run;
    }

    public function calculate(PayrollRun $run, User $actor): PayrollRun
    {
        if (! $run->isEditable()) {
            throw new ApiException(
                'Ye payroll ' . $run->statusLabel() . ' hai — ab amount nahi badal sakta.',
                409,
                'PAYROLL_LOCKED'
            );
        }

        $companyId = (int) $run->company_id;
        $employees = $this->payableEmployees($companyId, $run->month);

        if ($employees->isEmpty()) {
            throw new ApiException(
                'Is mahine ke liye koi employee nahi mila jiska structure set ho.',
                422,
                'NO_PAYABLE_EMPLOYEES'
            );
        }

        return DB::transaction(function () use ($run, $companyId, $employees, $actor): PayrollRun {
            $held = $this->keepHeldLop($run);

            PayrollItemLine::query()
                ->whereIn('item_id', PayrollItem::query()->where('run_id', $run->id)->select('id'))
                ->delete();

            PayrollItem::query()->where('run_id', $run->id)->forceDelete();

            $totals = ['earnings' => 0.0, 'deductions' => 0.0, 'net' => 0.0, 'employer' => 0.0];
            $monthDays = Carbon::parse($run->month . '-01')->daysInMonth;

            foreach ($employees as $employee) {
                $structure = $this->structures->forMonth($employee, $run->month);

                if ($structure === null) {
                    continue;
                }

                $working = $this->workingDays($employee, $run->month);
                $lop = $held[$employee->id] ?? $this->suggestLop($employee, $run->month, $working);
                $paidDays = round(max($working - $lop, 0), 2);

                $item = $this->writeItem($run, $employee, $structure, $working, $lop, $paidDays, $held, $actor);

                $totals['earnings'] += $item->gross_earnings;
                $totals['deductions'] += $item->total_deductions;
                $totals['net'] += $item->net_payable;
                $totals['employer'] += $item->employer_cost;
            }

            $run->forceFill([
                'status' => PayrollRun::CALCULATED,
                'headcount' => PayrollItem::query()->where('run_id', $run->id)->count(),
                'working_days' => $monthDays,
                'total_earnings' => round($totals['earnings'], 2),
                'total_deductions' => round($totals['deductions'], 2),
                'total_net' => round($totals['net'], 2),
                'total_employer' => round($totals['employer'], 2),
                'calculated_at' => Carbon::now(),
                'calculated_by' => $actor->id,
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();

            return $run->refresh();
        });
    }

    public function setLop(PayrollItem $item, float $days, User $actor): PayrollItem
    {
        $run = $item->run;

        if ($run === null || ! $run->isEditable()) {
            throw new ApiException(
                'Payroll approve ho chuka hai — LOP ab nahi badal sakta.',
                409,
                'PAYROLL_LOCKED'
            );
        }

        if ($days < 0 || $days > $item->working_days) {
            throw new ApiException(
                'LOP 0 se ' . $item->working_days . ' din ke beech hona chahiye.',
                422,
                'LOP_OUT_OF_RANGE'
            );
        }

        $employee = Employee::query()->withoutGlobalScope(CompanyScope::class)->find($item->employee_id);
        $structure = SalaryStructure::query()->with('lines')->find($item->structure_id);

        if ($employee === null || $structure === null) {
            throw new ApiException('Is payslip ka structure nahi mila.', 422, 'STRUCTURE_MISSING');
        }

        return DB::transaction(function () use ($item, $run, $employee, $structure, $days, $actor): PayrollItem {
            PayrollItemLine::query()->where('item_id', $item->id)->delete();

            $paidDays = round(max((float) $item->working_days - $days, 0), 2);

            $fresh = $this->writeItem(
                $run,
                $employee,
                $structure,
                (float) $item->working_days,
                $days,
                $paidDays,
                [$employee->id => $days],
                $actor,
                $item
            );

            $this->retotal($run, $actor);
            $this->flush();

            return $fresh->refresh()->load('lines');
        });
    }

    public function hold(PayrollItem $item, ?string $reason, User $actor): PayrollItem
    {
        if ($item->isPaid()) {
            throw new ApiException('Ye salary already ja chuki hai.', 409, 'ALREADY_PAID');
        }

        $item->forceFill([
            'payment_status' => PayrollItem::ON_HOLD,
            'hold_reason' => $reason,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $item->refresh();
    }

    public function release(PayrollItem $item, User $actor): PayrollItem
    {
        if (! $item->isOnHold()) {
            throw new ApiException('Ye payslip hold par nahi hai.', 409, 'NOT_ON_HOLD');
        }

        $item->forceFill([
            'payment_status' => PayrollItem::PENDING,
            'hold_reason' => null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $item->refresh();
    }

    public function approve(PayrollRun $run, User $actor): PayrollRun
    {
        if (! $run->isCalculated()) {
            throw new ApiException(
                $run->isDraft()
                    ? 'Pehle payroll calculate karo, phir approve.'
                    : 'Ye payroll ' . $run->statusLabel() . ' hai.',
                409,
                'PAYROLL_WRONG_STAGE'
            );
        }

        if ($run->headcount === 0) {
            throw new ApiException('Khaali payroll approve nahi hota.', 422, 'PAYROLL_EMPTY');
        }

        $run->forceFill([
            'status' => PayrollRun::APPROVED,
            'approved_at' => Carbon::now(),
            'approved_by' => $actor->id,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $this->announce($run, $actor);

        return $run->refresh();
    }

    public function cancel(PayrollRun $run, User $actor): PayrollRun
    {
        if ($run->paid_count > 0) {
            throw new ApiException(
                'Is payroll me ' . $run->paid_count . ' salary already ja chuki hai — cancel nahi hota.',
                409,
                'PAYROLL_PARTLY_PAID'
            );
        }

        $run->forceFill([
            'status' => PayrollRun::CANCELLED,
            'closed_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $run->refresh();
    }

    public function payslipsFor(User $actor): array
    {
        $employee = Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $actor->company_id)
            ->where('user_id', $actor->id)
            ->first();

        if ($employee === null) {
            return [];
        }

        return PayrollItem::query()
            ->with('lines', 'run')
            ->where('employee_id', $employee->id)
            ->whereHas('run', fn ($query) => $query->whereIn('status', [PayrollRun::APPROVED, PayrollRun::PAID]))
            ->get()
            ->sortByDesc(fn (PayrollItem $item): string => (string) $item->run?->month)
            ->values()
            ->all();
    }

    private function writeItem(
        PayrollRun $run,
        Employee $employee,
        SalaryStructure $structure,
        float $working,
        float $lop,
        float $paidDays,
        array $held,
        User $actor,
        ?PayrollItem $existing = null
    ): PayrollItem {
        $ratio = $working > 0 ? $paidDays / $working : 1.0;

        $item = $existing ?? new PayrollItem();
        $item->company_id = $run->company_id;
        $item->run_id = $run->id;
        $item->employee_id = $employee->id;
        $item->structure_id = $structure->id;

        $item->forceFill([
            'employee_code' => $employee->employee_code,
            'employee_name' => $employee->user?->name ?? 'Employee',
            'designation' => $employee->designation?->name,
            'pan_number' => $employee->pan_number,
            'uan_number' => $employee->uan_number,
            'annual_ctc' => $structure->annual_ctc,
            'working_days' => $working,
            'lop_days' => $lop,
            'paid_days' => $paidDays,
            'lop_suggested' => $this->suggestLop($employee, $run->month, $working),
            'lop_locked_by_hr' => array_key_exists($employee->id, $held),
            'updated_by' => $actor->id,
        ]);

        if ($item->created_by === null) {
            $item->created_by = $actor->id;
        }

        $item->save();

        $earnings = 0.0;
        $deductions = 0.0;
        $employer = 0.0;

        foreach ($structure->lines as $line) {
            $full = (float) $line->monthly_amount;

            $amount = $line->kind === SalaryComponent::EARNING
                ? round($full * $ratio, 2)
                : $full;

            if ($line->kind === SalaryComponent::EARNING) {
                $earnings += $amount;
            } elseif ($line->kind === SalaryComponent::DEDUCTION) {
                $deductions += $amount;
            } else {
                $employer += $amount;
            }

            $row = new PayrollItemLine([
                'code' => $line->code,
                'name' => $line->name,
                'kind' => $line->kind,
                'full_amount' => $full,
                'amount' => $amount,
                'is_statutory' => $line->is_statutory,
                'sequence' => $line->sequence,
            ]);

            $row->company_id = $run->company_id;
            $row->item_id = $item->id;
            $row->save();
        }

        $item->forceFill([
            'gross_earnings' => round($earnings, 2),
            'total_deductions' => round($deductions, 2),
            'employer_cost' => round($employer, 2),
            'net_payable' => round($earnings - $deductions, 2),
        ])->save();

        return $item;
    }

    private function retotal(PayrollRun $run, User $actor): void
    {
        $sums = PayrollItem::query()
            ->where('run_id', $run->id)
            ->selectRaw('COUNT(*) as headcount, SUM(gross_earnings) as earnings, SUM(total_deductions) as deductions, SUM(net_payable) as net, SUM(employer_cost) as employer')
            ->first();

        $run->forceFill([
            'headcount' => (int) ($sums->headcount ?? 0),
            'total_earnings' => round((float) ($sums->earnings ?? 0), 2),
            'total_deductions' => round((float) ($sums->deductions ?? 0), 2),
            'total_net' => round((float) ($sums->net ?? 0), 2),
            'total_employer' => round((float) ($sums->employer ?? 0), 2),
            'updated_by' => $actor->id,
        ])->save();
    }

    private function keepHeldLop(PayrollRun $run): array
    {
        return PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('lop_locked_by_hr', 1)
            ->pluck('lop_days', 'employee_id')
            ->map(fn ($days): float => (float) $days)
            ->all();
    }

    private function payableEmployees(int $companyId, string $month)
    {
        $end = Carbon::parse($month . '-01')->endOfMonth()->toDateString();

        return Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->with('user:id,name', 'designation:id,name', 'workShift')
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->where('date_of_joining', '<=', $end)
            ->where(fn ($query) => $query
                ->whereIn('employment_status', [Employee::EMPLOYMENT_ACTIVE, Employee::EMPLOYMENT_SERVING_NOTICE])
                ->orWhere(fn ($inner) => $inner
                    ->where('employment_status', Employee::EMPLOYMENT_EXITED)
                    ->where('exit_date', '>=', Carbon::parse($month . '-01')->toDateString())))
            ->get();
    }

    private function workingDays(Employee $employee, string $month): float
    {
        $start = Carbon::parse($month . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $days = 0;

        for ($date = $start->copy(); $date->lessThanOrEqualTo($end); $date->addDay()) {
            if (WorkCalendar::schedule($employee, $date)['is_working_day']) {
                $days++;
            }
        }

        return (float) $days;
    }

    private function suggestLop(Employee $employee, string $month, float $working): float
    {
        if ($working <= 0) {
            return 0.0;
        }

        $start = Carbon::parse($month . '-01')->startOfMonth()->toDateString();
        $end = Carbon::parse($month . '-01')->endOfMonth()->toDateString();

        $rows = Attendance::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [$start, $end])
            ->get(['status']);

        $absent = $rows->where('status', Attendance::ABSENT)->count();
        $half = $rows->where('status', Attendance::HALF_DAY)->count();

        return (float) min($working, $absent + ($half * 0.5));
    }

    private function defaultPayDate(int $companyId, string $month): string
    {
        $payDay = (int) DB::table('companies')->where('id', $companyId)->value('salary_pay_day');
        $next = Carbon::parse($month . '-01')->addMonth();

        if ($payDay <= 0) {
            return $next->copy()->endOfMonth()->toDateString();
        }

        return $next->copy()->day(min($payDay, $next->daysInMonth))->toDateString();
    }

    private function assertMonth(string $month, int $companyId): string
    {
        if (preg_match('/^\d{4}-\d{2}$/', $month) !== 1) {
            throw new ApiException('Month YYYY-MM format me bhejo.', 422, 'MONTH_INVALID');
        }

        $today = CompanyTime::day($companyId);

        if (Carbon::parse($month . '-01')->greaterThan($today->copy()->startOfMonth())) {
            throw new ApiException('Aane wale mahine ka payroll nahi chalta.', 422, 'MONTH_IN_FUTURE');
        }

        return $month;
    }

    private function announce(PayrollRun $run, User $actor): void
    {
        $hr = User::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $run->company_id)
            ->where('is_active', 1)
            ->get()
            ->filter(fn (User $user): bool => $user->hasPermission(PayrollRun::APPROVE_PERMISSION))
            ->pluck('id')
            ->all();

        foreach ($hr as $userId) {
            if ((int) $userId === (int) $actor->id) {
                continue;
            }

            $this->notifications->send((int) $userId, [
                'type' => NotificationType::PAYROLL_APPROVED,
                'title' => $run->monthLabel() . ' payroll approve ho gaya',
                'body' => $run->headcount . ' employee · net ₹' . number_format($run->total_net, 2),
                'action_url' => '/payroll',
                'entity_type' => 'payroll_run',
                'entity_id' => $run->id,
            ], $actor);
        }
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::EMPLOYEES);
    }
}

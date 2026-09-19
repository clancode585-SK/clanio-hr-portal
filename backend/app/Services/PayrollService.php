<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Attendance;
use App\Models\Company;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollItemLine;
use App\Models\PayrollRun;
use App\Models\SalaryAdvance;
use App\Models\SalaryComponent;
use App\Models\SalaryStructure;
use App\Models\User;
use App\Support\CompanyTime;
use App\Support\NotificationType;
use App\Support\PermissionLookup;
use App\Support\SalarySeal;
use App\Support\Scopes\CompanyScope;
use App\Support\TaxMath;
use App\Support\TenantCache;
use App\Support\WorkCalendar;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PayrollService
{
    private const ATTENTION_LIMIT = 50;

    private const BULK_CHUNK = 200;

    private array $ownEmployee = [];

    private array $workingDayMemo = [];

    private array $lopMemo = [];

    private array $companyMemo = [];

    private array $advanceMemo = [];

    private array $touchedAdvances = [];

    public function __construct(
        private readonly SalaryStructureService $structures,
        private readonly NotificationService $notifications,
        private readonly SalaryAdvanceService $advances
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

        $ids = $employees->pluck('id')->map(fn ($id): int => (int) $id)->all();

        $this->prefetchLop($companyId, $run->month, $ids);
        $structures = $this->structures->forMonthMany($ids, $run->month);

        return DB::transaction(function () use ($run, $employees, $structures, $actor, $companyId, $ids): PayrollRun {
            $held = $this->keepHeldLop($run);

            // Purani EMI rows hata kar dobara likhte hain, warna recalculate par do baar gin jaati
            $this->touchedAdvances = $this->advances->clearRun((int) $run->id);
            $this->advances->resync($this->touchedAdvances);
            $this->advanceMemo = $this->advances->recoveringFor($companyId, $ids, $run->month);

            PayrollItemLine::query()
                ->whereIn('item_id', PayrollItem::query()->where('run_id', $run->id)->select('id'))
                ->delete();

            PayrollItem::query()->where('run_id', $run->id)->forceDelete();

            $totals = ['earnings' => 0.0, 'deductions' => 0.0, 'net' => 0.0, 'employer' => 0.0];
            $monthDays = Carbon::parse($run->month . '-01')->daysInMonth;

            foreach ($employees as $employee) {
                $structure = $structures[(int) $employee->id] ?? null;

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

            $this->advances->resync($this->touchedAdvances);
            $this->advanceMemo = [];

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

            // Is payslip ki EMI row hata kar dobara likhi jaati hai
            $this->touchedAdvances = $this->advances->clearItem((int) $item->id);
            $this->advances->resync($this->touchedAdvances);
            $this->advanceMemo = $this->advances->recoveringFor(
                (int) $run->company_id,
                [(int) $employee->id],
                $run->month
            );

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

            $this->advances->resync($this->touchedAdvances);
            $this->advanceMemo = [];

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

    public function approveItem(PayrollItem $item, User $actor): PayrollItem
    {
        $run = $item->run;

        if ($run === null || ! $run->isEditable()) {
            throw new ApiException(
                'Ye payroll ' . ($run?->statusLabel() ?? 'band') . ' hai — ab approval nahi badalti.',
                409,
                'PAYROLL_LOCKED'
            );
        }

        $blocker = $this->approvalBlocker($item, $actor);

        if ($blocker !== null) {
            throw new ApiException($blocker['message'], 409, $blocker['code']);
        }

        $item->forceFill([
            'approval_status' => PayrollItem::APPROVED,
            'approved_at' => Carbon::now(),
            'approved_by' => $actor->id,
            'fingerprint' => SalarySeal::forItem($item),
            'updated_by' => $actor->id,
        ])->save();

        $this->countApprovals($run);
        $this->flush();

        return $item->refresh()->load('lines', 'run');
    }

    public function unapproveItem(PayrollItem $item, User $actor): PayrollItem
    {
        $run = $item->run;

        if ($run === null || ! $run->isEditable()) {
            throw new ApiException(
                'Payroll approve ho chuka hai — ab approval wapas nahi hoti.',
                409,
                'PAYROLL_LOCKED'
            );
        }

        $item->forceFill([
            'approval_status' => PayrollItem::PENDING,
            'approved_at' => null,
            'approved_by' => null,
            'fingerprint' => null,
            'updated_by' => $actor->id,
        ])->save();

        $this->countApprovals($run);
        $this->flush();

        return $item->refresh()->load('lines', 'run');
    }

    public function approveItems(PayrollRun $run, User $actor, ?array $uuids = null): array
    {
        if (! $run->isEditable()) {
            throw new ApiException(
                'Ye payroll ' . $run->statusLabel() . ' hai — ab approval nahi badalti.',
                409,
                'PAYROLL_LOCKED'
            );
        }

        $mine = $this->ownEmployeeId($actor);
        $now = Carbon::now();

        $lookedAt = 0;
        $approved = 0;
        $already = 0;
        $amount = 0.0;
        $skipped = [];

        PayrollItem::query()
            ->with('lines')
            ->where('run_id', $run->id)
            ->when($uuids !== null, fn ($query) => $query->whereIn('uuid', $uuids))
            ->orderBy('id')
            ->chunkById(self::BULK_CHUNK, function ($items) use (
                $actor, $mine, $now, &$lookedAt, &$approved, &$already, &$amount, &$skipped
            ): void {
                foreach ($items as $item) {
                    $lookedAt++;

                    if ($item->isApproved()) {
                        $already++;
                        $amount += (float) $item->net_payable;

                        continue;
                    }

                    $blocker = $this->blockerFor($item, $mine);

                    if ($blocker !== null) {
                        if (count($skipped) < self::ATTENTION_LIMIT) {
                            $skipped[] = [
                                'uuid' => $item->uuid,
                                'employee_code' => $item->employee_code,
                                'employee_name' => $item->employee_name,
                                'reason' => $blocker['message'],
                                'code' => $blocker['code'],
                            ];
                        }

                        continue;
                    }

                    $item->forceFill([
                        'approval_status' => PayrollItem::APPROVED,
                        'approved_at' => $now,
                        'approved_by' => $actor->id,
                        'fingerprint' => SalarySeal::forItem($item),
                        'updated_by' => $actor->id,
                    ])->save();

                    $approved++;
                    $amount += (float) $item->net_payable;
                }
            });

        $this->countApprovals($run);
        $this->flush();

        $blocked = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('approval_status', PayrollItem::PENDING)
            ->when($uuids !== null, fn ($query) => $query->whereIn('uuid', $uuids))
            ->count();

        return [
            'run' => $run->refresh(),
            'looked_at' => $lookedAt,
            'approved' => $approved,
            'already_approved' => $already,
            'skipped' => $skipped,
            'skipped_count' => $blocked,
            'approved_amount' => round($amount, 2),
        ];
    }

    public function approvalReview(PayrollRun $run, User $actor): array
    {
        $mine = $this->ownEmployeeId($actor);
        $ready = $this->readyFilter($run, $mine);

        $counts = PayrollItem::query()
            ->where('run_id', $run->id)
            ->selectRaw('COUNT(*) as headcount')
            ->selectRaw('SUM(approval_status = ?) as approved', [PayrollItem::APPROVED])
            ->selectRaw('SUM(payment_status = ?) as stopped', [PayrollItem::ON_HOLD])
            ->selectRaw('SUM(lop_days > 0) as with_lop')
            ->first();

        $readyTotals = (clone $ready)
            ->selectRaw('COUNT(*) as headcount, SUM(net_payable) as amount')
            ->first();

        $cut = PayrollItem::query()
            ->join('payroll_item_lines as l', 'l.item_id', '=', 'payroll_items.id')
            ->where('payroll_items.run_id', $run->id)
            ->where('payroll_items.lop_days', '>', 0)
            ->where('l.kind', SalaryComponent::EARNING)
            ->selectRaw('SUM(l.full_amount - l.amount) as cut')
            ->value('cut');

        return [
            'headcount' => (int) ($counts->headcount ?? 0),
            'approved' => (int) ($counts->approved ?? 0),
            'stopped' => (int) ($counts->stopped ?? 0),
            'ready_to_approve' => (int) ($readyTotals->headcount ?? 0),
            'ready_amount' => round((float) ($readyTotals->amount ?? 0), 2),
            'with_lop' => (int) ($counts->with_lop ?? 0),
            'lop_amount_cut' => round((float) ($cut ?? 0), 2),
            'needs_attention' => $this->needsAttention($run, $mine),
        ];
    }

    private function readyFilter(PayrollRun $run, ?int $mine)
    {
        return PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('approval_status', PayrollItem::PENDING)
            ->where('payment_status', '!=', PayrollItem::ON_HOLD)
            ->where('net_payable', '>', 0)
            ->where(fn ($query) => $query
                ->where('lop_suggested', '<=', 0)
                ->orWhere('lop_locked_by_hr', 1))
            ->when($mine !== null, fn ($query) => $query
                ->where(fn ($inner) => $inner
                    ->where('employee_id', '!=', $mine)
                    ->orWhere('lop_days', '<=', 0)));
    }

    private function needsAttention(PayrollRun $run, ?int $mine): array
    {
        $rows = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('approval_status', PayrollItem::PENDING)
            ->where(function ($query) use ($mine): void {
                $query->where('payment_status', PayrollItem::ON_HOLD)
                    ->orWhere('net_payable', '<=', 0)
                    ->orWhere(fn ($inner) => $inner
                        ->where('lop_suggested', '>', 0)
                        ->where('lop_locked_by_hr', 0));

                if ($mine !== null) {
                    $query->orWhere(fn ($inner) => $inner
                        ->where('employee_id', $mine)
                        ->where('lop_days', '>', 0));
                }
            })
            ->orderBy('employee_code')
            ->limit(self::ATTENTION_LIMIT)
            ->get([
                'uuid', 'employee_code', 'employee_name', 'net_payable', 'payment_status',
                'hold_reason', 'lop_days', 'lop_suggested', 'lop_locked_by_hr', 'employee_id',
                'approval_status',
            ]);

        return $rows
            ->map(function (PayrollItem $item) use ($mine): array {
                $blocker = $this->blockerFor($item, $mine);

                return [
                    'uuid' => $item->uuid,
                    'employee_code' => $item->employee_code,
                    'employee_name' => $item->employee_name,
                    'net_payable' => (float) $item->net_payable,
                    'reason' => $blocker['message'] ?? 'Dekhna padega.',
                    'code' => $blocker['code'] ?? 'UNKNOWN',
                ];
            })
            ->all();
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

        $waiting = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('approval_status', PayrollItem::PENDING)
            ->where('payment_status', '!=', PayrollItem::ON_HOLD)
            ->count();

        if ($waiting > 0) {
            throw new ApiException(
                $waiting . ' employee ki salary abhi approve nahi hui. Sabko approve karo ya unko stop karo.',
                409,
                'ITEMS_NOT_APPROVED'
            );
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

        // Run cancel hui to EMI bhi wapas, warna employee ka advance kam dikhega
        $this->advances->resync($this->advances->clearRun((int) $run->id));

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
            'approval_status' => PayrollItem::PENDING,
            'approved_at' => null,
            'approved_by' => null,
            'fingerprint' => null,
            'updated_by' => $actor->id,
        ]);

        if ($item->created_by === null) {
            $item->created_by = $actor->id;
        }

        $item->save();

        $earnings = 0.0;
        $deductions = 0.0;
        $employer = 0.0;
        $rows = [];
        $stamp = Carbon::now();

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

            $rows[] = [
                'company_id' => $run->company_id,
                'item_id' => $item->id,
                'code' => $line->code,
                'name' => $line->name,
                'kind' => $line->kind,
                'full_amount' => $full,
                'amount' => $amount,
                'is_statutory' => $line->is_statutory ? 1 : 0,
                'sequence' => $line->sequence,
                'created_at' => $stamp,
                'updated_at' => $stamp,
            ];
        }

        $tds = $this->tdsFor($employee, $structure, $run->month);

        if ($tds > 0) {
            $rows = $this->putLine($rows, $run, $item, SalaryComponent::TDS, 'TDS', $tds, 900, true, $stamp);
            $deductions += $tds;
        }

        $emi = $this->advanceEmiFor($employee, $run, $item, $actor);

        if ($emi > 0) {
            $rows = $this->putLine($rows, $run, $item, 'ADVANCE', 'Advance Salary Recovery', $emi, 950, false, $stamp);
            $deductions += $emi;
        }

        if ($rows !== []) {
            DB::table('payroll_item_lines')->insert($rows);
        }

        $item->forceFill([
            'gross_earnings' => round($earnings, 2),
            'total_deductions' => round($deductions, 2),
            'employer_cost' => round($employer, 2),
            'net_payable' => round($earnings - $deductions, 2),
        ])->save();

        return $item;
    }

    // TDS ya advance ki line pehle se ho to usi ko badal dete hain, warna nayi jodte hain
    private function putLine(
        array $rows,
        PayrollRun $run,
        PayrollItem $item,
        string $code,
        string $name,
        float $amount,
        int $sequence,
        bool $statutory,
        Carbon $stamp
    ): array {
        foreach ($rows as $index => $row) {
            if ($row['code'] === $code) {
                $rows[$index]['amount'] = $amount;
                $rows[$index]['full_amount'] = $amount;

                return $rows;
            }
        }

        $rows[] = [
            'company_id' => $run->company_id,
            'item_id' => $item->id,
            'code' => $code,
            'name' => $name,
            'kind' => SalaryComponent::DEDUCTION,
            'full_amount' => $amount,
            'amount' => $amount,
            'is_statutory' => $statutory ? 1 : 0,
            'sequence' => $sequence,
            'created_at' => $stamp,
            'updated_at' => $stamp,
        ];

        return $rows;
    }

    private function tdsFor(Employee $employee, SalaryStructure $structure, string $month): float
    {
        $companyId = (int) $employee->company_id;

        if (! array_key_exists($companyId, $this->companyMemo)) {
            $this->companyMemo[$companyId] = Company::query()->find($companyId);
        }

        $company = $this->companyMemo[$companyId];

        if ($company === null || ! $company->tds_enabled) {
            return 0.0;
        }

        $on = Carbon::parse($month . '-01');
        $months = TaxMath::payableMonths(
            $employee->date_of_joining === null ? null : Carbon::parse($employee->date_of_joining),
            $employee->exit_date === null ? null : Carbon::parse($employee->exit_date),
            $on
        );

        if ($months <= 0) {
            return 0.0;
        }

        $annual = 0.0;

        foreach ($structure->lines as $line) {
            if ($line->kind === SalaryComponent::EARNING && $line->is_taxable) {
                $annual += (float) $line->monthly_amount * $months;
            }
        }

        if ($annual <= 0) {
            return 0.0;
        }

        $deducted = $this->tdsPaidInFy((int) $employee->id, $on);

        return TaxMath::project($annual, $deducted, $on)['monthly_tds'];
    }


    // Isi financial year me jitna TDS approve/paid ho chuka hai
    private function tdsPaidInFy(int $employeeId, Carbon $on): float
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

    private function advanceEmiFor(Employee $employee, PayrollRun $run, PayrollItem $item, User $actor): float
    {
        $advance = $this->advanceMemo[(int) $employee->id] ?? null;

        if (! $advance instanceof SalaryAdvance) {
            return 0.0;
        }

        $due = $advance->dueFor($run->month);

        if ($due <= 0) {
            return 0.0;
        }

        $this->advances->recordRecovery(
            $advance,
            $run->month,
            $due,
            'payroll',
            (int) $run->id,
            (int) $item->id,
            null,
            $actor
        );

        $this->touchedAdvances[] = (int) $advance->id;

        return $due;
    }

    private function approvalBlocker(PayrollItem $item, User $actor): ?array
    {
        return $this->blockerFor($item, $this->ownEmployeeId($actor));
    }

    private function blockerFor(PayrollItem $item, ?int $mine): ?array
    {
        if ($item->isOnHold()) {
            return [
                'code' => 'ITEM_STOPPED',
                'message' => 'Salary stop par hai'
                    . ($item->hold_reason ? ' — ' . $item->hold_reason : '') . '.',
            ];
        }

        if ((float) $item->net_payable <= 0) {
            return ['code' => 'ITEM_ZERO', 'message' => 'Net amount zero hai.'];
        }

        if ((float) $item->lop_suggested > 0 && ! (bool) $item->lop_locked_by_hr) {
            return [
                'code' => 'LOP_UNDECIDED',
                'message' => 'Attendance ' . rtrim(rtrim(number_format((float) $item->lop_suggested, 1, '.', ''), '0'), '.')
                    . ' din LOP keh rahi hai. Pehle LOP set karo — 0 rakhna ho to bhi save karo.',
            ];
        }

        if ($mine !== null && $mine === (int) $item->employee_id && (float) $item->lop_days > 0) {
            return [
                'code' => 'SELF_APPROVAL_WITH_LOP',
                'message' => 'Apni salary par LOP lagi hai — isko dusra approver hi approve karega.',
            ];
        }

        return null;
    }

    private function ownEmployeeId(User $actor): ?int
    {
        $key = (int) $actor->id;

        if (! array_key_exists($key, $this->ownEmployee)) {
            $found = Employee::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $actor->company_id)
                ->where('user_id', $actor->id)
                ->value('id');

            $this->ownEmployee[$key] = $found === null ? null : (int) $found;
        }

        return $this->ownEmployee[$key];
    }

    private function countApprovals(PayrollRun $run): void
    {
        $run->forceFill([
            'approved_count' => PayrollItem::query()
                ->where('run_id', $run->id)
                ->where('approval_status', PayrollItem::APPROVED)
                ->count(),
            'stopped_count' => PayrollItem::query()
                ->where('run_id', $run->id)
                ->where('payment_status', PayrollItem::ON_HOLD)
                ->count(),
        ])->save();
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

        $this->countApprovals($run);
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
            ->with('user:id,name,branch_id', 'designation:id,name', 'workShift')
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
        $key = $month . ':' . ($employee->work_shift_id ?? 0) . ':' . ($employee->user?->branch_id ?? 0);

        if (array_key_exists($key, $this->workingDayMemo)) {
            return $this->workingDayMemo[$key];
        }

        $start = Carbon::parse($month . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $days = 0;

        for ($date = $start->copy(); $date->lessThanOrEqualTo($end); $date->addDay()) {
            if (WorkCalendar::schedule($employee, $date)['is_working_day']) {
                $days++;
            }
        }

        return $this->workingDayMemo[$key] = (float) $days;
    }

    private function suggestLop(Employee $employee, string $month, float $working): float
    {
        if ($working <= 0) {
            return 0.0;
        }

        $days = $this->lopMemo[$month][$employee->id] ?? null;

        if ($days === null) {
            $start = Carbon::parse($month . '-01')->startOfMonth()->toDateString();
            $end = Carbon::parse($month . '-01')->endOfMonth()->toDateString();

            $rows = Attendance::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('employee_id', $employee->id)
                ->whereBetween('attendance_date', [$start, $end])
                ->get(['status']);

            $days = $rows->where('status', Attendance::ABSENT)->count()
                + ($rows->where('status', Attendance::HALF_DAY)->count() * 0.5);
        }

        return (float) min($working, $days);
    }

    private function prefetchLop(int $companyId, string $month, array $employeeIds): void
    {
        if ($employeeIds === []) {
            return;
        }

        $start = Carbon::parse($month . '-01')->startOfMonth()->toDateString();
        $end = Carbon::parse($month . '-01')->endOfMonth()->toDateString();

        $rows = Attendance::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->whereIn('employee_id', $employeeIds)
            ->whereBetween('attendance_date', [$start, $end])
            ->whereIn('status', [Attendance::ABSENT, Attendance::HALF_DAY])
            ->selectRaw('employee_id')
            ->selectRaw('SUM(status = ?) as absent', [Attendance::ABSENT])
            ->selectRaw('SUM(status = ?) as half_day', [Attendance::HALF_DAY])
            ->groupBy('employee_id')
            ->get();

        $this->lopMemo[$month] = [];

        foreach ($employeeIds as $id) {
            $this->lopMemo[$month][$id] = 0.0;
        }

        foreach ($rows as $row) {
            $this->lopMemo[$month][(int) $row->employee_id] =
                (float) $row->absent + ((float) $row->half_day * 0.5);
        }
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
        $hr = PermissionLookup::userIdsWith(PayrollRun::APPROVE_PERMISSION, (int) $run->company_id);

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

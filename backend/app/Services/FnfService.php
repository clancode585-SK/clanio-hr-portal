<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeExit;
use App\Models\ExitClearance;
use App\Models\FnfLine;
use App\Models\FnfSettlement;
use App\Models\SalaryComponent;
use App\Models\SalaryStructure;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\SalarySeal;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use App\Support\WorkCalendar;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class FnfService
{
    private array $ownEmployee = [];

    public function __construct(private readonly NotificationService $notifications) {}

    public function open(EmployeeExit $exit, User $actor): FnfSettlement
    {
        if (! in_array($exit->status, [EmployeeExit::SERVING_NOTICE, EmployeeExit::EXITED], true)) {
            throw new ApiException(
                'Exit approve hone ke baad hi FnF banega. Abhi status ' . $exit->status . ' hai.',
                409,
                'EXIT_NOT_APPROVED'
            );
        }

        $existing = FnfSettlement::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('employee_exit_id', $exit->id)
            ->first();

        if ($existing !== null) {
            throw new ApiException('Is exit ka FnF already bana hua hai.', 409, 'FNF_ALREADY_OPEN');
        }

        $employee = $this->employeeFor($exit);

        $settlement = new FnfSettlement();
        $settlement->company_id = $exit->company_id;
        $settlement->employee_exit_id = $exit->id;
        $settlement->employee_id = $employee->id;
        $settlement->created_by = $actor->id;

        $settlement->forceFill([
            'employee_code' => $employee->employee_code,
            'employee_name' => $employee->user?->name ?? 'Employee',
            'designation' => $employee->designation?->name,
            'pan_number' => $employee->pan_number,
            'uan_number' => $employee->uan_number,
            'date_of_joining' => $employee->date_of_joining?->toDateString(),
            'last_working_date' => $exit->last_working_date?->toDateString(),
        ])->save();

        $this->flush();

        return $this->calculate($settlement->refresh(), $actor);
    }

    public function calculate(FnfSettlement $settlement, User $actor): FnfSettlement
    {
        $this->assertEditable($settlement);

        $exit = $settlement->exit;
        $employee = $this->employeeFor($exit);
        $lastDay = Carbon::parse($settlement->last_working_date);
        $structure = $this->structureFor($employee, $lastDay);

        if ($structure === null) {
            throw new ApiException(
                $settlement->employee_name . ' ka salary structure set nahi hai — uske bina hisaab nahi ban sakta.',
                422,
                'STRUCTURE_MISSING'
            );
        }

        $settings = $this->settings((int) $settlement->company_id);
        $basic = $this->basicOf($structure);
        $gross = (float) $structure->monthly_gross;

        $days = $this->lastMonthDays($employee, $lastDay);
        $notice = $this->noticeDays($exit, $lastDay);

        return DB::transaction(function () use ($settlement, $employee, $exit, $structure, $settings, $basic, $gross, $days, $notice, $lastDay, $actor): FnfSettlement {
            $kept = $this->keepDecisions($settlement);

            FnfLine::query()
                ->withoutGlobalScopes()
                ->where('settlement_id', $settlement->id)
                ->delete();

            $settlement->structure_id = $structure->id;

            $settlement->forceFill([
                'service_years' => $this->serviceYears($employee, $lastDay),
                'monthly_gross' => $gross,
                'monthly_basic' => $basic,
                'working_days' => $days['working'],
                'paid_days' => $days['paid'],
                'notice_required_days' => $notice['required'],
                'notice_served_days' => $notice['served'],
                'notice_shortfall_days' => $notice['shortfall'],
                'calculated_at' => Carbon::now(),
                'calculated_by' => $actor->id,
                'updated_by' => $actor->id,
                'status' => FnfSettlement::CALCULATED,
            ])->save();

            foreach ($this->buildLines($settlement, $structure, $settings, $basic, $gross, $days, $notice, $lastDay) as $line) {
                $decision = $kept[$line['code']] ?? null;

                $row = new FnfLine();
                $row->company_id = $settlement->company_id;
                $row->settlement_id = $settlement->id;
                $row->created_by = $actor->id;

                $row->forceFill($line + [
                    'is_applied' => $decision === null ? ($line['source'] !== FnfLine::SUGGESTED) : $decision['is_applied'],
                    'amount' => $decision === null
                        ? ($line['source'] === FnfLine::SUGGESTED ? 0 : $line['suggested_amount'])
                        : $decision['amount'],
                ])->save();
            }

            foreach ($kept as $code => $decision) {
                if ($decision['source'] !== FnfLine::MANUAL) {
                    continue;
                }

                $row = new FnfLine();
                $row->company_id = $settlement->company_id;
                $row->settlement_id = $settlement->id;
                $row->created_by = $actor->id;

                $row->forceFill([
                    'code' => $code,
                    'name' => $decision['name'],
                    'kind' => $decision['kind'],
                    'source' => FnfLine::MANUAL,
                    'is_applied' => $decision['is_applied'],
                    'amount' => $decision['amount'],
                    'suggested_amount' => 0,
                    'note' => $decision['note'],
                    'sequence' => 300,
                ])->save();
            }

            $this->retotal($settlement, $actor);
            $this->flush();

            return $settlement->refresh()->load('lines', 'employee.user');
        });
    }

    public function applyLine(FnfLine $line, bool $applied, ?float $amount, User $actor): FnfSettlement
    {
        $settlement = $line->settlement;

        if ($settlement === null) {
            throw new ApiException('Settlement nahi mila.', 404, 'NOT_FOUND');
        }

        $this->assertEditable($settlement);

        if ($amount !== null && $amount < 0) {
            throw new ApiException('Amount minus me nahi ho sakta.', 422, 'AMOUNT_INVALID');
        }

        $line->forceFill([
            'is_applied' => $applied,
            'amount' => $amount ?? ($applied ? (float) $line->suggested_amount : 0),
            'updated_by' => $actor->id,
        ])->save();

        $this->retotal($settlement, $actor);
        $this->flush();

        return $settlement->refresh()->load('lines');
    }

    public function addLine(FnfSettlement $settlement, array $data, User $actor): FnfSettlement
    {
        $this->assertEditable($settlement);

        $row = new FnfLine($data);
        $row->company_id = $settlement->company_id;
        $row->settlement_id = $settlement->id;
        $row->source = FnfLine::MANUAL;
        $row->is_applied = true;
        $row->sequence = 300;
        $row->created_by = $actor->id;
        $row->save();

        $this->retotal($settlement, $actor);
        $this->flush();

        return $settlement->refresh()->load('lines');
    }

    public function removeLine(FnfLine $line, User $actor): FnfSettlement
    {
        $settlement = $line->settlement;

        if ($settlement === null) {
            throw new ApiException('Settlement nahi mila.', 404, 'NOT_FOUND');
        }

        $this->assertEditable($settlement);

        if ($line->source !== FnfLine::MANUAL) {
            throw new ApiException(
                'Ye line tool ne banayi hai — hata nahi sakte. Amount 0 karna ho to Apply hata do.',
                409,
                'LINE_NOT_MANUAL'
            );
        }

        $line->deactivate();

        $this->retotal($settlement, $actor);
        $this->flush();

        return $settlement->refresh()->load('lines');
    }

    public function approve(FnfSettlement $settlement, User $actor): FnfSettlement
    {
        $blocker = $this->approvalBlocker($settlement, $actor);

        if ($blocker !== null) {
            throw new ApiException($blocker['message'], 409, $blocker['code']);
        }

        $settlement->loadMissing('lines');

        $settlement->forceFill([
            'status' => FnfSettlement::APPROVED,
            'payment_status' => $settlement->owesCompany()
                ? FnfSettlement::RECOVERABLE
                : FnfSettlement::PENDING,
            'approved_at' => Carbon::now(),
            'approved_by' => $actor->id,
            'fingerprint' => SalarySeal::forSettlement($settlement),
            'updated_by' => $actor->id,
        ])->save();

        $this->settleAdvance($settlement, $actor);

        $this->flush();
        $this->tellEmployee($settlement, $actor);

        return $settlement->refresh();
    }

    // FnF me jitna advance kaata gaya, utna hi advance ledger me bhi jaana chahiye
    private function settleAdvance(FnfSettlement $settlement, User $actor): void
    {
        $advances = app(SalaryAdvanceService::class);
        $touched = $advances->clearSettlement((int) $settlement->id);

        $line = $settlement->lines->firstWhere('code', FnfLine::ADVANCE_RECOVERY);
        $advance = $advances->openFor((int) $settlement->employee_id);

        if ($line !== null && $line->is_applied && $advance !== null && (float) $line->amount > 0) {
            $advances->recordRecovery(
                $advance,
                Carbon::parse($settlement->last_working_date)->format('Y-m'),
                (float) $line->amount,
                'fnf',
                null,
                null,
                (int) $settlement->id,
                $actor
            );

            $touched[] = (int) $advance->id;
        }

        $advances->resync($touched);
    }

    public function approveMany(array $uuids, User $actor): array
    {
        $settlements = FnfSettlement::query()
            ->visibleTo($actor)
            ->with('lines', 'exit')
            ->whereIn('uuid', $uuids)
            ->orderBy('employee_code')
            ->get();

        $approved = 0;
        $amount = 0.0;
        $skipped = [];

        foreach ($settlements as $settlement) {
            $blocker = $this->approvalBlocker($settlement, $actor);

            if ($blocker !== null) {
                $skipped[] = [
                    'uuid' => $settlement->uuid,
                    'employee_code' => $settlement->employee_code,
                    'employee_name' => $settlement->employee_name,
                    'reason' => $blocker['message'],
                    'code' => $blocker['code'],
                ];

                continue;
            }

            $this->approve($settlement, $actor);

            $approved++;
            $amount += (float) $settlement->net_payable;
        }

        return [
            'looked_at' => $settlements->count(),
            'approved' => $approved,
            'skipped' => $skipped,
            'approved_amount' => round($amount, 2),
        ];
    }

    public function hold(FnfSettlement $settlement, ?string $reason, User $actor): FnfSettlement
    {
        if ($settlement->payment_status === FnfSettlement::PAID) {
            throw new ApiException('Paisa already ja chuka hai.', 409, 'FNF_ALREADY_PAID');
        }

        $settlement->forceFill([
            'payment_status' => FnfSettlement::ON_HOLD,
            'hold_reason' => $reason,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $settlement->refresh();
    }

    public function release(FnfSettlement $settlement, User $actor): FnfSettlement
    {
        if ($settlement->payment_status !== FnfSettlement::ON_HOLD) {
            throw new ApiException('Ye settlement hold par nahi hai.', 409, 'NOT_ON_HOLD');
        }

        $settlement->forceFill([
            'payment_status' => $settlement->owesCompany()
                ? FnfSettlement::RECOVERABLE
                : FnfSettlement::PENDING,
            'hold_reason' => null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $settlement->refresh();
    }

    private function approvalBlocker(FnfSettlement $settlement, User $actor): ?array
    {
        if ($settlement->status !== FnfSettlement::CALCULATED) {
            return [
                'code' => 'FNF_WRONG_STAGE',
                'message' => $settlement->status === FnfSettlement::DRAFT
                    ? 'Pehle calculate karo, phir approve.'
                    : 'Ye settlement ' . $settlement->statusLabel() . ' hai.',
            ];
        }

        $exit = $settlement->exit;

        if ($exit !== null && $exit->status !== EmployeeExit::EXITED) {
            return [
                'code' => 'EXIT_NOT_DONE',
                'message' => 'Employee ka last working day nikalne ke baad hi FnF approve hoga.',
            ];
        }

        if ($settlement->payment_status === FnfSettlement::ON_HOLD) {
            return [
                'code' => 'FNF_STOPPED',
                'message' => 'Ye settlement stop par hai'
                    . ($settlement->hold_reason ? ' — ' . $settlement->hold_reason : '') . '.',
            ];
        }

        if ($this->isOwn($settlement, $actor) && $this->hasHrDeduction($settlement)) {
            return [
                'code' => 'SELF_APPROVAL_WITH_DEDUCTION',
                'message' => 'Apne settlement par deduction lagi hai — isko dusra approver hi approve karega.',
            ];
        }

        return null;
    }

    private function isOwn(FnfSettlement $settlement, User $actor): bool
    {
        $key = (int) $actor->id;

        if (! array_key_exists($key, $this->ownEmployee)) {
            $found = DB::table('employees')
                ->where('company_id', $actor->company_id)
                ->where('user_id', $actor->id)
                ->value('id');

            $this->ownEmployee[$key] = $found === null ? null : (int) $found;
        }

        return $this->ownEmployee[$key] !== null
            && $this->ownEmployee[$key] === (int) $settlement->employee_id;
    }

    private function hasHrDeduction(FnfSettlement $settlement): bool
    {
        $settlement->loadMissing('lines');

        return $settlement->lines->contains(
            fn (FnfLine $line): bool => ! $line->isEarning()
                && $line->source !== FnfLine::AUTO
                && $line->counts()
        );
    }

    public function cancel(FnfSettlement $settlement, User $actor): FnfSettlement
    {
        if ($settlement->isSettled() || $settlement->payment_status === FnfSettlement::PAID) {
            throw new ApiException('Paisa ja chuka hai — cancel nahi hota.', 409, 'FNF_ALREADY_PAID');
        }

        $settlement->forceFill([
            'status' => FnfSettlement::CANCELLED,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $settlement->refresh();
    }

    public function markRecovered(FnfSettlement $settlement, User $actor): FnfSettlement
    {
        if (! $settlement->owesCompany()) {
            throw new ApiException('Is settlement me employee par kuch baaki nahi hai.', 409, 'NOTHING_TO_RECOVER');
        }

        if (! $settlement->isApproved()) {
            throw new ApiException('Pehle settlement approve karo.', 409, 'FNF_WRONG_STAGE');
        }

        $settlement->forceFill([
            'status' => FnfSettlement::SETTLED,
            'payment_status' => FnfSettlement::PAID,
            'settled_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $settlement->refresh();
    }

    public function pending(int $companyId): array
    {
        $exits = EmployeeExit::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->with('employee.user')
            ->where('company_id', $companyId)
            ->whereIn('status', [EmployeeExit::SERVING_NOTICE, EmployeeExit::EXITED])
            ->whereDoesntHave('settlement')
            ->orderBy('last_working_date')
            ->get();

        return $exits
            ->map(fn (EmployeeExit $exit): array => [
                'exit_uuid' => $exit->uuid,
                'employee_code' => $exit->employee?->employee_code,
                'employee_name' => $exit->employee?->user?->name,
                'last_working_date' => $exit->last_working_date?->format('Y-m-d'),
                'status' => $exit->status,
                'is_ready' => $exit->status === EmployeeExit::EXITED,
            ])
            ->all();
    }

    private function buildLines(
        FnfSettlement $settlement,
        SalaryStructure $structure,
        array $settings,
        float $basic,
        float $gross,
        array $days,
        array $notice,
        Carbon $lastDay
    ): array {
        $ratio = $days['working'] > 0 ? $days['paid'] / $days['working'] : 1.0;
        $lines = [];
        $sequence = 10;

        foreach ($structure->lines as $line) {
            if ($line->kind === SalaryComponent::EMPLOYER_COST) {
                continue;
            }

            $full = (float) $line->monthly_amount;

            $amount = $line->kind === SalaryComponent::EARNING
                ? round($full * $ratio, 2)
                : $full;

            if ($amount === 0.0) {
                continue;
            }

            $lines[] = [
                'code' => $line->code,
                'name' => $line->kind === SalaryComponent::EARNING
                    ? $line->name . ' (' . $this->plainDays($days['paid']) . ' of ' . $this->plainDays($days['working']) . ' days)'
                    : $line->name,
                'kind' => $line->kind === SalaryComponent::EARNING ? FnfLine::EARNING : FnfLine::DEDUCTION,
                'source' => FnfLine::AUTO,
                'suggested_amount' => $amount,
                'basis' => $line->kind === SalaryComponent::EARNING
                    ? '₹' . number_format($full, 2) . ' × ' . $this->plainDays($days['paid']) . '/' . $this->plainDays($days['working'])
                    : null,
                'sequence' => $sequence += 10,
            ];
        }

        if ($settings['encashment_enabled']) {
            $encash = $this->encashment($settlement, $settings, $basic);

            if ($encash !== null) {
                $lines[] = $encash;
            }
        }

        if ($settings['gratuity_enabled']) {
            $gratuity = $this->gratuity($settlement, $settings, $basic);

            if ($gratuity !== null) {
                $lines[] = $gratuity;
            }
        }

        if ($notice['shortfall'] > 0) {
            $perDay = $settings['notice_recovery_basis'] === 'basic' ? $basic : $gross;
            $rate = $days['working'] > 0 ? $perDay / $days['working'] : 0;

            $lines[] = [
                'code' => FnfLine::NOTICE_SHORTFALL,
                'name' => 'Notice period shortfall (' . $notice['shortfall'] . ' days)',
                'kind' => FnfLine::DEDUCTION,
                'source' => FnfLine::SUGGESTED,
                'suggested_amount' => round($rate * $notice['shortfall'], 2),
                'basis' => $notice['served'] . ' of ' . $notice['required'] . ' days served · ₹'
                    . number_format($perDay, 2) . ' ÷ ' . $this->plainDays($days['working'])
                    . ' × ' . $notice['shortfall'],
                'sequence' => 210,
            ];
        }

        $recovery = $this->clearanceRecovery($settlement);

        if ($recovery > 0) {
            $lines[] = [
                'code' => FnfLine::CLEARANCE_RECOVERY,
                'name' => 'Clearance recovery',
                'kind' => FnfLine::DEDUCTION,
                'source' => FnfLine::SUGGESTED,
                'suggested_amount' => $recovery,
                'basis' => 'Clearance checklist me jo wapas nahi aaya',
                'sequence' => 220,
            ];
        }

        $advance = app(SalaryAdvanceService::class)->openFor((int) $settlement->employee_id);

        if ($advance !== null && (float) $advance->outstanding > 0) {
            $lines[] = [
                'code' => FnfLine::ADVANCE_RECOVERY,
                'name' => 'Salary advance baaki (' . $advance->reference . ')',
                'kind' => FnfLine::DEDUCTION,
                'source' => FnfLine::SUGGESTED,
                'suggested_amount' => round((float) $advance->outstanding, 2),
                'basis' => '₹' . number_format((float) $advance->amount, 2) . ' me se ₹'
                    . number_format((float) $advance->recovered, 2) . ' EMI se kat chuka hai',
                'sequence' => 230,
            ];
        }

        return $lines;
    }

    private function encashment(FnfSettlement $settlement, array $settings, float $basic): ?array
    {
        $year = Carbon::parse($settlement->last_working_date)->year;

        $rows = DB::table('leave_balances as b')
            ->join('leave_types as t', 't.id', '=', 'b.leave_type_id')
            ->where('b.employee_id', $settlement->employee_id)
            ->where('b.year', $year)
            ->where('t.is_encashable', 1)
            ->where('t.is_active', 1)
            ->get(['t.name', 't.encashment_max', 'b.available']);

        $days = 0.0;
        $names = [];

        foreach ($rows as $row) {
            $usable = (float) $row->available;

            if ($usable <= 0) {
                continue;
            }

            if ($row->encashment_max !== null && (float) $row->encashment_max > 0) {
                $usable = min($usable, (float) $row->encashment_max);
            }

            $days += $usable;
            $names[] = $this->plainDays($usable) . ' ' . $row->name;
        }

        if ($days <= 0) {
            return null;
        }

        $base = $settings['encashment_basis'] === 'gross'
            ? (float) $settlement->monthly_gross
            : $basic;

        $perDay = $settings['encashment_month_days'] > 0 ? $base / $settings['encashment_month_days'] : 0;

        return [
            'code' => FnfLine::LEAVE_ENCASHMENT,
            'name' => 'Leave encashment (' . $this->plainDays($days) . ' days)',
            'kind' => FnfLine::EARNING,
            'source' => FnfLine::AUTO,
            'suggested_amount' => round($perDay * $days, 2),
            'basis' => implode(', ', $names) . ' · ₹' . number_format($base, 2) . ' ÷ '
                . $this->plainDays($settings['encashment_month_days']),
            'sequence' => 150,
        ];
    }

    private function gratuity(FnfSettlement $settlement, array $settings, float $basic): ?array
    {
        $years = (float) $settlement->service_years;

        if ($years < $settings['gratuity_min_years']) {
            return null;
        }

        $countable = (int) floor($years);

        if ($years - $countable >= 0.5) {
            $countable++;
        }

        $perDay = $settings['gratuity_month_days'] > 0 ? $basic / $settings['gratuity_month_days'] : 0;
        $amount = round($perDay * $settings['gratuity_days_per_year'] * $countable, 2);

        if ($amount <= 0) {
            return null;
        }

        return [
            'code' => FnfLine::GRATUITY,
            'name' => 'Gratuity (' . $countable . ' years)',
            'kind' => FnfLine::EARNING,
            'source' => FnfLine::AUTO,
            'suggested_amount' => $amount,
            'basis' => '₹' . number_format($basic, 2) . ' × '
                . $this->plainDays($settings['gratuity_days_per_year']) . '/'
                . $this->plainDays($settings['gratuity_month_days']) . ' × ' . $countable,
            'sequence' => 160,
        ];
    }

    private function clearanceRecovery(FnfSettlement $settlement): float
    {
        return round((float) DB::table('exit_clearances')
            ->where('employee_exit_id', $settlement->employee_exit_id)
            ->where('is_active', 1)
            ->where('is_recoverable', 1)
            ->where('status', ExitClearance::BLOCKED)
            ->sum('recoverable_amount'), 2);
    }

    private function keepDecisions(FnfSettlement $settlement): array
    {
        return FnfLine::query()
            ->where('settlement_id', $settlement->id)
            ->get()
            ->mapWithKeys(fn (FnfLine $line): array => [$line->code => [
                'is_applied' => (bool) $line->is_applied,
                'amount' => (float) $line->amount,
                'kind' => $line->kind,
                'name' => $line->name,
                'note' => $line->note,
                'source' => $line->source,
            ]])
            ->all();
    }

    private function retotal(FnfSettlement $settlement, User $actor): void
    {
        $lines = FnfLine::query()->where('settlement_id', $settlement->id)->get();

        $earnings = round($lines
            ->filter(fn (FnfLine $line): bool => $line->isEarning() && $line->is_applied)
            ->sum('amount'), 2);

        $deductions = round($lines
            ->filter(fn (FnfLine $line): bool => ! $line->isEarning() && $line->is_applied)
            ->sum('amount'), 2);

        $net = round($earnings - $deductions, 2);

        $settlement->forceFill([
            'total_earnings' => $earnings,
            'total_deductions' => $deductions,
            'net_payable' => $net,
            'recoverable' => $net < 0 ? abs($net) : 0,
            'updated_by' => $actor->id,
        ])->save();
    }

    private function lastMonthDays(Employee $employee, Carbon $lastDay): array
    {
        $start = $lastDay->copy()->startOfMonth();
        $end = $lastDay->copy()->endOfMonth();

        $working = 0;
        $paid = 0;

        for ($date = $start->copy(); $date->lessThanOrEqualTo($end); $date->addDay()) {
            if (! WorkCalendar::schedule($employee, $date)['is_working_day']) {
                continue;
            }

            $working++;

            if ($date->lessThanOrEqualTo($lastDay)) {
                $paid++;
            }
        }

        return ['working' => (float) $working, 'paid' => (float) $paid];
    }

    private function noticeDays(EmployeeExit $exit, Carbon $lastDay): array
    {
        $required = (int) ($exit->notice_period_days ?? 0);

        $served = $exit->resignation_date === null
            ? $required
            : (int) $exit->resignation_date->diffInDays($lastDay, false);

        $served = max($served, 0);

        return [
            'required' => $required,
            'served' => $served,
            'shortfall' => max($required - $served, 0),
        ];
    }

    private function serviceYears(Employee $employee, Carbon $lastDay): float
    {
        if ($employee->date_of_joining === null) {
            return 0.0;
        }

        return round($employee->date_of_joining->floatDiffInYears($lastDay), 2);
    }

    private function structureFor(Employee $employee, Carbon $lastDay): ?SalaryStructure
    {
        return SalaryStructure::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->with('lines')
            ->where('employee_id', $employee->id)
            ->effectiveOn($lastDay->toDateString())
            ->orderByDesc('effective_from')
            ->first();
    }

    private function basicOf(SalaryStructure $structure): float
    {
        foreach ($structure->lines as $line) {
            if ($line->code === SalaryComponent::BASIC) {
                return (float) $line->monthly_amount;
            }
        }

        return 0.0;
    }

    private function settings(int $companyId): array
    {
        $row = DB::table('companies')->where('id', $companyId)->first([
            'gratuity_enabled',
            'gratuity_min_years',
            'gratuity_days_per_year',
            'gratuity_month_days',
            'encashment_enabled',
            'encashment_basis',
            'encashment_month_days',
            'notice_recovery_basis',
        ]);

        return [
            'gratuity_enabled' => (bool) ($row->gratuity_enabled ?? false),
            'gratuity_min_years' => (float) ($row->gratuity_min_years ?? 5),
            'gratuity_days_per_year' => (float) ($row->gratuity_days_per_year ?? 15),
            'gratuity_month_days' => (float) ($row->gratuity_month_days ?? 26),
            'encashment_enabled' => (bool) ($row->encashment_enabled ?? false),
            'encashment_basis' => (string) ($row->encashment_basis ?? 'basic'),
            'encashment_month_days' => (float) ($row->encashment_month_days ?? 26),
            'notice_recovery_basis' => (string) ($row->notice_recovery_basis ?? 'gross'),
        ];
    }

    private function employeeFor(?EmployeeExit $exit): Employee
    {
        $employee = $exit === null
            ? null
            : Employee::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->with('user:id,name', 'designation:id,name', 'workShift')
                ->find($exit->employee_id);

        if ($employee === null) {
            throw new ApiException('Is exit ka employee record nahi mila.', 422, 'EMPLOYEE_MISSING');
        }

        return $employee;
    }

    private function assertEditable(FnfSettlement $settlement): void
    {
        if (! $settlement->isEditable()) {
            throw new ApiException(
                'Ye settlement ' . $settlement->statusLabel() . ' hai — ab amount nahi badal sakta.',
                409,
                'FNF_LOCKED'
            );
        }
    }

    private function plainDays(float $value): string
    {
        return rtrim(rtrim(number_format($value, 1, '.', ''), '0'), '.');
    }

    private function tellEmployee(FnfSettlement $settlement, User $actor): void
    {
        $userId = DB::table('employees')->where('id', $settlement->employee_id)->value('user_id');

        if ($userId === null) {
            return;
        }

        $this->notifications->send((int) $userId, [
            'type' => NotificationType::FNF_APPROVED,
            'title' => 'Aapka full and final approve ho gaya',
            'body' => $settlement->owesCompany()
                ? 'Hisaab ke baad ₹' . number_format(abs($settlement->net_payable), 2) . ' company ko dene hain. HR aapse baat karegi.'
                : '₹' . number_format($settlement->net_payable, 2) . ' aapke bank account me bhej diya jaayega.',
            'action_url' => '/my-payslips',
            'entity_type' => 'fnf_settlement',
            'entity_id' => $settlement->id,
        ], $actor);
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::EXITS);
    }
}

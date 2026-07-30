<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class LeaveBalanceService
{
    public function allocate(int $companyId, int $year, User $actor): array
    {
        $types = LeaveType::query()->where('status', 'active')->get();
        $employees = Employee::query()->select('id', 'company_id')->get();
        $created = 0;

        DB::transaction(function () use ($types, $employees, $year, $actor, &$created): void {
            foreach ($employees as $employee) {
                foreach ($types as $type) {
                    $exists = LeaveBalance::query()
                        ->where('employee_id', $employee->id)
                        ->where('leave_type_id', $type->id)
                        ->where('year', $year)
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    $balance = new LeaveBalance(['year' => $year]);
                    $balance->company_id = $employee->company_id;
                    $balance->employee_id = $employee->id;
                    $balance->leave_type_id = $type->id;
                    $balance->accrued = $type->accruesMonthly() ? 0 : $type->annual_quota;
                    $balance->created_by = $actor->id;
                    $balance->save();

                    $created++;
                }
            }
        });

        $this->flush();

        return [
            'year' => $year,
            'employees' => $employees->count(),
            'leave_types' => $types->count(),
            'balances_created' => $created,
        ];
    }

    public function accrue(int $year, User $actor): array
    {
        $month = Carbon::now()->format('Y-m');
        $credited = 0;
        $skipped = 0;

        $balances = LeaveBalance::query()
            ->with('leaveType')
            ->where('year', $year)
            ->whereHas('leaveType', fn ($query) => $query->where('accrual_type', LeaveType::MONTHLY))
            ->get();

        DB::transaction(function () use ($balances, $month, $actor, &$credited, &$skipped): void {
            foreach ($balances as $balance) {
                $type = $balance->leaveType;

                if ($balance->last_accrued_on === $month || $type === null) {
                    $skipped++;

                    continue;
                }

                $next = min($type->annual_quota, round($balance->accrued + $type->monthlyAccrual(), 2));

                $balance->forceFill([
                    'accrued' => $next,
                    'last_accrued_on' => $month,
                    'updated_by' => $actor->id,
                ])->save();

                $credited++;
            }
        });

        $this->flush();

        return [
            'month' => $month,
            'credited' => $credited,
            'already_done' => $skipped,
        ];
    }

    public function carryForward(int $fromYear, User $actor): array
    {
        $toYear = $fromYear + 1;
        $moved = 0;
        $lapsed = 0.0;

        $balances = LeaveBalance::query()->with('leaveType')->where('year', $fromYear)->get();

        DB::transaction(function () use ($balances, $toYear, $actor, &$moved, &$lapsed): void {
            foreach ($balances as $balance) {
                $type = $balance->leaveType;

                if ($type === null) {
                    continue;
                }

                $available = max(0.0, (float) $balance->available);
                $carry = $type->carry_forward ? min($available, $type->carryForwardCap()) : 0.0;
                $lapsed += $available - $carry;

                $next = LeaveBalance::query()
                    ->where('employee_id', $balance->employee_id)
                    ->where('leave_type_id', $balance->leave_type_id)
                    ->where('year', $toYear)
                    ->first();

                if ($next === null) {
                    $next = new LeaveBalance(['year' => $toYear]);
                    $next->company_id = $balance->company_id;
                    $next->employee_id = $balance->employee_id;
                    $next->leave_type_id = $balance->leave_type_id;
                    $next->accrued = $type->accruesMonthly() ? 0 : $type->annual_quota;
                    $next->created_by = $actor->id;
                }

                $next->forceFill(['opening' => round($carry, 2), 'updated_by' => $actor->id])->save();

                $moved++;
            }
        });

        $this->flush();

        return [
            'from_year' => $fromYear,
            'to_year' => $toYear,
            'balances_processed' => $moved,
            'days_lapsed' => round($lapsed, 2),
        ];
    }

    public function adjust(LeaveBalance $balance, float $days, string $remarks, User $actor): LeaveBalance
    {
        $adjusted = round($balance->adjusted + $days, 2);

        if ($balance->available + $days < 0) {
            throw new ApiException(
                'This adjustment would make the balance negative. Available: ' . $balance->available . ' days.',
                422,
                'LEAVE_BALANCE_NEGATIVE'
            );
        }

        $balance->forceFill(['adjusted' => $adjusted, 'updated_by' => $actor->id])->save();

        $this->flush();

        return $balance->refresh()->load('leaveType', 'employee.user');
    }

    public function encash(LeaveBalance $balance, float $days, User $actor): array
    {
        $type = $balance->leaveType;

        if ($type === null || ! $type->is_encashable) {
            throw new ApiException(
                'This leave type cannot be encashed.',
                422,
                'LEAVE_NOT_ENCASHABLE'
            );
        }

        if ($days > $balance->available) {
            throw new ApiException(
                'Only ' . $balance->available . ' days are available to encash.',
                422,
                'LEAVE_BALANCE_SHORT'
            );
        }

        $alreadyAndNow = round($balance->encashed + $days, 2);

        if ($alreadyAndNow > $type->encashmentCap()) {
            throw new ApiException(
                'Encashment limit for ' . $type->name . ' is ' . $type->encashmentCap() . ' days per year.',
                422,
                'LEAVE_ENCASHMENT_LIMIT'
            );
        }

        $balance->forceFill(['encashed' => $alreadyAndNow, 'updated_by' => $actor->id])->save();

        $this->flush();

        return [
            'balance' => $balance->refresh()->load('leaveType', 'employee.user'),
            'encashed_now' => $days,
            'encashed_total' => $alreadyAndNow,
            'note' => 'Amount payroll module calculate karega. Yahan sirf din record hue hain.',
        ];
    }

    public function balanceFor(Employee $employee, LeaveType $type, int $year, bool $lock = false): ?LeaveBalance
    {
        return LeaveBalance::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('employee_id', $employee->id)
            ->where('leave_type_id', $type->id)
            ->where('year', $year)
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->first();
    }

    public function ensureBalance(Employee $employee, LeaveType $type, int $year, User $actor): LeaveBalance
    {
        $balance = $this->balanceFor($employee, $type, $year, true);

        if ($balance !== null) {
            return $balance;
        }

        $balance = new LeaveBalance(['year' => $year]);
        $balance->company_id = $employee->company_id;
        $balance->employee_id = $employee->id;
        $balance->leave_type_id = $type->id;
        $balance->accrued = $type->accruesMonthly() ? $type->monthlyAccrual() : $type->annual_quota;
        $balance->created_by = $actor->id;
        $balance->save();

        return $balance;
    }

    public function pendingDays(Employee $employee, LeaveType $type, int $year): float
    {
        return (float) DB::table('leave_requests')
            ->where('employee_id', $employee->id)
            ->where('leave_type_id', $type->id)
            ->where('status', LeaveRequest::PENDING)
            ->whereNull('deleted_at')
            ->whereYear('from_date', $year)
            ->sum('day_count');
    }

    public function flush(): void
    {
        TenantCache::flush(TenantCache::LEAVE_BALANCES);
    }
}

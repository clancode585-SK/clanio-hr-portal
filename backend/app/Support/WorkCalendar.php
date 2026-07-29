<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Employee;
use App\Models\Holiday;
use App\Models\WorkShift;
use App\Support\Scopes\CompanyScope;
use Illuminate\Support\Carbon;

final class WorkCalendar
{
    public const WORKING = 'working';

    public const WEEK_OFF = 'week_off';

    public const HOLIDAY = 'holiday';

    public static function day(Employee $employee, Carbon $date): array
    {
        $shift = self::shiftFor($employee);
        $holiday = self::holidaysFor($employee)[$date->toDateString()] ?? null;

        if ($holiday !== null && $holiday['blocks_attendance']) {
            return self::state(self::HOLIDAY, $shift, $holiday);
        }

        if ($shift !== null && $shift->isWeeklyOff($date)) {
            return self::state(self::WEEK_OFF, $shift, $holiday);
        }

        return self::state(self::WORKING, $shift, $holiday);
    }

    public static function shiftFor(Employee $employee): ?WorkShift
    {
        $shifts = self::shifts($employee->company_id);

        if ($employee->work_shift_id !== null && isset($shifts[$employee->work_shift_id])) {
            return $shifts[$employee->work_shift_id];
        }

        foreach ($shifts as $shift) {
            if ($shift->is_default) {
                return $shift;
            }
        }

        return null;
    }

    public static function holidaysFor(Employee $employee): array
    {
        return self::holidays($employee->company_id, $employee->user?->branch_id);
    }

    private static function state(string $dayType, ?WorkShift $shift, ?array $holiday): array
    {
        return [
            'day_type' => $dayType,
            'is_working_day' => $dayType === self::WORKING,
            'holiday' => $holiday,
            'shift' => $shift === null ? null : [
                'id' => $shift->id,
                'name' => $shift->name,
                'start_time' => substr((string) $shift->start_time, 0, 5),
                'end_time' => substr((string) $shift->end_time, 0, 5),
                'grace_minutes' => $shift->grace_minutes,
                'half_day_minutes' => $shift->half_day_minutes,
                'full_day_minutes' => $shift->full_day_minutes,
                'weekly_offs' => $shift->weeklyOffDays(),
            ],
        ];
    }

    private static function shifts(int $companyId): array
    {
        return TenantCache::remember(
            TenantCache::WORK_SHIFTS,
            'calendar:' . $companyId,
            fn (): array => WorkShift::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $companyId)
                ->where('status', 'active')
                ->get()
                ->keyBy('id')
                ->all()
        );
    }

    private static function holidays(int $companyId, ?int $branchId): array
    {
        return TenantCache::remember(
            TenantCache::HOLIDAYS,
            'calendar:' . $companyId . ':' . ($branchId ?? 0),
            fn (): array => Holiday::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $companyId)
                ->forBranch($branchId)
                ->orderByRaw('branch_id IS NULL DESC')
                ->get()
                ->keyBy(fn (Holiday $holiday): string => $holiday->holiday_date->format('Y-m-d'))
                ->map(fn (Holiday $holiday): array => [
                    'id' => $holiday->id,
                    'name' => $holiday->name,
                    'type' => $holiday->type,
                    'is_paid' => $holiday->is_paid,
                    'blocks_attendance' => $holiday->blocksAttendance(),
                ])
                ->all()
        );
    }
}

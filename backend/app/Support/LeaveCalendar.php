<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Employee;
use App\Models\LeaveType;
use Illuminate\Support\Carbon;

final class LeaveCalendar
{
    public static function plan(
        Employee $employee,
        Carbon $from,
        Carbon $to,
        LeaveType $type,
        bool $halfDay = false,
        ?string $session = null
    ): array {
        $days = [];
        $skipped = [];
        $count = 0.0;
        $portion = $halfDay ? 0.5 : 1.0;

        for ($date = $from->copy()->startOfDay(); $date->lessThanOrEqualTo($to); $date->addDay()) {
            $schedule = WorkCalendar::schedule($employee, $date);

            if (! self::counts($schedule['day_type'], $type)) {
                $skipped[] = [
                    'date' => $date->toDateString(),
                    'reason' => $schedule['day_type'],
                    'holiday' => $schedule['holiday']['name'] ?? null,
                ];

                continue;
            }

            $days[] = [
                'date' => $date->toDateString(),
                'portion' => $portion,
                'session' => $halfDay ? $session : null,
            ];

            $count += $portion;
        }

        return [
            'days' => $days,
            'count' => round($count, 1),
            'skipped' => $skipped,
        ];
    }

    private static function counts(string $dayType, LeaveType $type): bool
    {
        return match ($dayType) {
            WorkCalendar::HOLIDAY => $type->count_holiday,
            WorkCalendar::WEEK_OFF => $type->count_weekly_off,
            default => true,
        };
    }
}

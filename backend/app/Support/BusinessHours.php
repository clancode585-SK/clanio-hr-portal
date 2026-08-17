<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Holiday;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class BusinessHours
{
    private const MAX_DAYS = 400;

    public static function calendarFor(int $companyId): array
    {
        $timezone = (string) (DB::table('companies')->where('id', $companyId)->value('timezone') ?: config('app.timezone'));

        $shift = DB::table('work_shifts')
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->first(['start_time', 'end_time', 'weekly_offs']);

        if ($shift === null) {
            return self::roundTheClock($timezone);
        }

        $offs = array_map('intval', json_decode((string) $shift->weekly_offs, true) ?: []);

        if (count(array_unique($offs)) >= 7) {
            return self::roundTheClock($timezone);
        }

        $minutes = self::spanMinutes((string) $shift->start_time, (string) $shift->end_time);

        if ($minutes <= 0) {
            return self::roundTheClock($timezone);
        }

        $holidays = DB::table('holidays')
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->whereNull('branch_id')
            ->where('type', Holiday::PUBLIC)
            ->pluck('holiday_date')
            ->map(fn ($date): string => Carbon::parse($date)->toDateString())
            ->all();

        return [
            'timezone' => $timezone,
            'start_time' => (string) $shift->start_time,
            'minutes_per_day' => $minutes,
            'weekly_offs' => array_values(array_unique($offs)),
            'holidays' => array_flip($holidays),
            'round_the_clock' => false,
        ];
    }

    public static function add(array $calendar, Carbon $from, int $minutes): Carbon
    {
        if ($calendar['round_the_clock'] || $minutes <= 0) {
            return $from->copy()->addMinutes(max($minutes, 0));
        }

        $cursor = $from->copy()->setTimezone($calendar['timezone']);
        $remaining = $minutes;

        for ($guard = 0; $guard < self::MAX_DAYS; $guard++) {
            $window = self::windowAt($calendar, $cursor);

            if ($window === null) {
                $cursor = self::nextOpening($calendar, $cursor);

                continue;
            }

            if ($cursor->lessThan($window['start'])) {
                $cursor = $window['start']->copy();
            }

            $available = (int) $cursor->diffInMinutes($window['end']);

            if ($remaining <= $available) {
                return $cursor->addMinutes($remaining)->setTimezone($from->getTimezone());
            }

            $remaining -= $available;
            $cursor = self::nextOpening($calendar, $window['end']);
        }

        return $from->copy()->addMinutes($minutes);
    }

    public static function between(array $calendar, Carbon $from, Carbon $to): int
    {
        if ($to->lessThanOrEqualTo($from)) {
            return 0;
        }

        if ($calendar['round_the_clock']) {
            return (int) $from->diffInMinutes($to);
        }

        $start = $from->copy()->setTimezone($calendar['timezone']);
        $end = $to->copy()->setTimezone($calendar['timezone']);

        $date = $start->copy()->subDay()->startOfDay();
        $last = $end->copy()->startOfDay();
        $total = 0;

        for ($guard = 0; $guard <= self::MAX_DAYS && $date->lessThanOrEqualTo($last); $guard++) {
            $window = self::windowFor($calendar, $date);

            if ($window !== null) {
                $overlapStart = $start->greaterThan($window['start']) ? $start : $window['start'];
                $overlapEnd = $end->lessThan($window['end']) ? $end : $window['end'];

                if ($overlapEnd->greaterThan($overlapStart)) {
                    $total += (int) $overlapStart->diffInMinutes($overlapEnd);
                }
            }

            $date->addDay();
        }

        return $total;
    }

    public static function isOpen(array $calendar, Carbon $moment): bool
    {
        if ($calendar['round_the_clock']) {
            return true;
        }

        $cursor = $moment->copy()->setTimezone($calendar['timezone']);
        $window = self::windowAt($calendar, $cursor);

        return $window !== null && $cursor->greaterThanOrEqualTo($window['start']);
    }

    private static function windowAt(array $calendar, Carbon $moment): ?array
    {
        foreach ([$moment->copy()->subDay()->startOfDay(), $moment->copy()->startOfDay()] as $date) {
            $window = self::windowFor($calendar, $date);

            if ($window !== null && $moment->lessThan($window['end'])) {
                return $window;
            }
        }

        return null;
    }

    private static function windowFor(array $calendar, Carbon $date): ?array
    {
        if (! self::isWorkingDay($calendar, $date)) {
            return null;
        }

        $start = $date->copy()->startOfDay()->setTimeFromTimeString($calendar['start_time']);

        return ['start' => $start, 'end' => $start->copy()->addMinutes($calendar['minutes_per_day'])];
    }

    private static function nextOpening(array $calendar, Carbon $after): Carbon
    {
        $date = $after->copy()->addDay()->startOfDay();

        for ($guard = 0; $guard < self::MAX_DAYS; $guard++) {
            if (self::isWorkingDay($calendar, $date)) {
                return $date->setTimeFromTimeString($calendar['start_time']);
            }

            $date->addDay();
        }

        return $after->copy();
    }

    private static function isWorkingDay(array $calendar, Carbon $date): bool
    {
        if (in_array($date->dayOfWeek, $calendar['weekly_offs'], true)) {
            return false;
        }

        return ! isset($calendar['holidays'][$date->toDateString()]);
    }

    private static function spanMinutes(string $start, string $end): int
    {
        $from = Carbon::createFromTimeString($start);
        $to = Carbon::createFromTimeString($end);
        $minutes = (int) $from->diffInMinutes($to, false);

        return $minutes > 0 ? $minutes : $minutes + 1440;
    }

    private static function roundTheClock(string $timezone): array
    {
        return [
            'timezone' => $timezone,
            'start_time' => '00:00:00',
            'minutes_per_day' => 1440,
            'weekly_offs' => [],
            'holidays' => [],
            'round_the_clock' => true,
        ];
    }
}

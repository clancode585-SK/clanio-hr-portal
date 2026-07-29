<?php

declare(strict_types=1);

namespace App\Support;

use Closure;

final class AttendanceCache
{
    private const LIVE_TTL = 900;

    public static function state(int $employeeId, string $date, Closure $resolver): array
    {
        return TenantCache::remember(
            TenantCache::ATTENDANCE,
            self::stateKey($employeeId, $date),
            $resolver,
            self::LIVE_TTL
        );
    }

    public static function forgetState(int $employeeId, string $date): void
    {
        TenantCache::forget(TenantCache::ATTENDANCE, self::stateKey($employeeId, $date));
    }

    public static function flushLists(): void
    {
        TenantCache::flush(TenantCache::ATTENDANCE);
    }

    private static function stateKey(int $employeeId, string $date): string
    {
        return 'state:' . $employeeId . ':' . $date;
    }
}

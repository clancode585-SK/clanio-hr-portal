<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\Cache;

final class TenantCache
{
    public const COMPANIES = 'companies';

    public const BRANCHES = 'branches';

    public const DEPARTMENTS = 'departments';

    public const TEAMS = 'teams';

    public const DESIGNATIONS = 'designations';

    public const EMPLOYEES = 'employees';

    public const ATTENDANCE = 'attendance';

    public const WORK_SHIFTS = 'work_shifts';

    public const HOLIDAYS = 'holidays';

    public const ROLES = 'roles';

    public const USERS = 'users';

    public const PERMISSIONS = 'permissions';

    private const TTL = 3600;

    public static function remember(string $group, string $key, callable $callback, ?int $ttl = null): mixed
    {
        return Cache::remember(self::key($group, $key), $ttl ?? self::TTL, $callback);
    }

    public static function forget(string $group, string $key): void
    {
        Cache::forget(self::key($group, $key));
    }

    public static function flush(string ...$groups): void
    {
        foreach ($groups as $group) {
            Cache::forever(self::versionKey($group), self::version($group) + 1);
        }
    }

    public static function signature(array $input): string
    {
        ksort($input);

        return md5((string) json_encode($input));
    }

    private static function key(string $group, string $key): string
    {
        return sprintf('hrms:%s:%s:v%d:%s', self::scope(), $group, self::version($group), $key);
    }

    private static function versionKey(string $group): string
    {
        return sprintf('hrms:%s:%s:version', self::scope(), $group);
    }

    private static function version(string $group): int
    {
        $version = Cache::get(self::versionKey($group));

        if ($version === null) {
            Cache::forever(self::versionKey($group), 1);

            return 1;
        }

        return (int) $version;
    }

    private static function scope(): string
    {
        return (string) (app(TenantContext::class)->id() ?? 'platform');
    }
}

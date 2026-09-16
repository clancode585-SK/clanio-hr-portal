<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Company;
use Illuminate\Support\Carbon;

final class CompanyTime
{
    private const FALLBACK = 'Asia/Kolkata';

    private static array $cache = [];

    public static function zone(Company|int|null $company = null): string
    {
        if ($company instanceof Company) {
            return self::clean($company->timezone);
        }

        $id = $company ?? app(TenantContext::class)->id();

        if ($id === null) {
            $current = app(TenantContext::class)->company();

            return $current === null ? self::FALLBACK : self::clean($current->timezone);
        }

        if (! array_key_exists($id, self::$cache)) {
            self::$cache[$id] = self::clean(
                Company::query()->withoutGlobalScopes()->whereKey($id)->value('timezone')
            );
        }

        return self::$cache[$id];
    }

    public static function now(Company|int|null $company = null): Carbon
    {
        return Carbon::now(self::zone($company));
    }

    public static function today(Company|int|null $company = null): Carbon
    {
        return self::now($company)->startOfDay();
    }

    public static function date(Company|int|null $company = null): string
    {
        return self::now($company)->toDateString();
    }

    public static function day(Company|int|null $company = null): Carbon
    {
        return Carbon::parse(self::date($company))->startOfDay();
    }

    public static function at(string $date, string $time, Company|int|null $company = null): Carbon
    {
        return Carbon::parse(trim($date) . ' ' . trim($time), self::zone($company));
    }

    public static function parse(string $moment, Company|int|null $company = null): Carbon
    {
        $value = trim($moment);

        return preg_match('/(?:[zZ]|[+-]\d{2}:?\d{2})$/', $value) === 1
            ? Carbon::parse($value)
            : Carbon::parse($value, self::zone($company));
    }

    public static function toZone(?Carbon $moment, Company|int|null $company = null): ?Carbon
    {
        return $moment?->copy()->setTimezone(self::zone($company));
    }

    public static function forget(): void
    {
        self::$cache = [];
    }

    private static function clean(?string $zone): string
    {
        if ($zone === null || trim($zone) === '') {
            return self::FALLBACK;
        }

        return in_array(trim($zone), timezone_identifiers_list(), true) ? trim($zone) : self::FALLBACK;
    }
}

<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Company;
use App\Models\PayrollRun;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class TransferWindow
{
    private const FALLBACK_TIME = '10:00:00';

    private static array $cache = [];

    public static function opensAt(PayrollRun $run): Carbon
    {
        return CompanyTime::toZone($run->transfer_scheduled_at, (int) $run->company_id)
            ?? self::payMoment($run);
    }

    public static function payMoment(PayrollRun $run): Carbon
    {
        $date = $run->pay_date?->toDateString()
            ?? Carbon::parse($run->month . '-01')->endOfMonth()->toDateString();

        return CompanyTime::at($date, self::payTime((int) $run->company_id), (int) $run->company_id);
    }

    public static function isOpen(PayrollRun $run): bool
    {
        return CompanyTime::now((int) $run->company_id)->greaterThanOrEqualTo(self::opensAt($run));
    }

    public static function defaultMoment(Company|int $company, string $month): Carbon
    {
        $companyId = $company instanceof Company ? (int) $company->id : $company;
        $settings = self::settings($companyId);

        $day = max(min((int) $settings['salary_pay_day'], 28), 1);
        $date = Carbon::parse($month . '-01')->day($day)->toDateString();

        return CompanyTime::at($date, (string) $settings['salary_pay_time'], $companyId);
    }

    public static function describe(PayrollRun $run): array
    {
        $opens = self::opensAt($run);
        $now = CompanyTime::now((int) $run->company_id);
        $open = $now->greaterThanOrEqualTo($opens);

        return [
            'opens_at' => $opens->toIso8601String(),
            'opens_label' => $opens->format('d M Y, g:i A'),
            'is_open' => $open,
            'is_scheduled' => $run->transfer_scheduled_at !== null,
            'pay_moment' => self::payMoment($run)->toIso8601String(),
            'pay_moment_label' => self::payMoment($run)->format('d M Y, g:i A'),
            'hours_left' => $open ? 0 : max((int) ceil($now->diffInMinutes($opens, false) / 60), 0),
            'zone' => CompanyTime::zone((int) $run->company_id),
        ];
    }

    public static function payTime(int $companyId): string
    {
        return (string) self::settings($companyId)['salary_pay_time'];
    }

    public static function earlyBlocked(int $companyId): bool
    {
        return (bool) self::settings($companyId)['transfer_early_block'];
    }

    public static function forget(): void
    {
        self::$cache = [];
    }

    private static function settings(int $companyId): array
    {
        if (array_key_exists($companyId, self::$cache)) {
            return self::$cache[$companyId];
        }

        $row = DB::table('companies')->where('id', $companyId)->first([
            'salary_pay_day',
            'salary_pay_time',
            'transfer_early_block',
        ]);

        return self::$cache[$companyId] = [
            'salary_pay_day' => (int) ($row->salary_pay_day ?? 7),
            'salary_pay_time' => (string) ($row->salary_pay_time ?? self::FALLBACK_TIME),
            'transfer_early_block' => (bool) ($row->transfer_early_block ?? true),
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\FnfSettlement;
use App\Models\PayrollItem;

final class SalarySeal
{
    public static function forItem(PayrollItem $item): string
    {
        $item->loadMissing('lines');

        $parts = [
            'item',
            $item->id,
            $item->run_id,
            $item->employee_id,
            self::money($item->gross_earnings),
            self::money($item->total_deductions),
            self::money($item->net_payable),
            self::money($item->paid_days),
            self::money($item->lop_days),
        ];

        foreach ($item->lines as $line) {
            $parts[] = $line->code . ':' . $line->kind . ':' . self::money($line->amount);
        }

        return hash('sha256', implode('|', $parts));
    }

    public static function forSettlement(FnfSettlement $settlement): string
    {
        $settlement->loadMissing('lines');

        $parts = [
            'fnf',
            $settlement->id,
            $settlement->employee_id,
            self::money($settlement->total_earnings),
            self::money($settlement->total_deductions),
            self::money($settlement->net_payable),
            self::money($settlement->paid_days),
        ];

        foreach ($settlement->lines as $line) {
            $parts[] = $line->code . ':' . $line->kind . ':'
                . ($line->is_applied ? '1' : '0') . ':' . self::money($line->amount);
        }

        return hash('sha256', implode('|', $parts));
    }

    public static function holds(?string $sealed, string $current): bool
    {
        return $sealed === null || hash_equals($sealed, $current);
    }

    private static function money(float|int|string|null $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }
}

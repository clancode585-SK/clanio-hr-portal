<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\CarbonInterface;

class TaxMath
{
    public const NEW_REGIME = 'new';

    public const STANDARD_DEDUCTION = 75000.0;

    public const REBATE_LIMIT = 1200000.0;

    public const REBATE_CAP = 60000.0;

    public const CESS_PERCENT = 4.0;

    // FY 2025-26 new regime slabs
    public const SLABS = [
        [0, 400000, 0],
        [400000, 800000, 5],
        [800000, 1200000, 10],
        [1200000, 1600000, 15],
        [1600000, 2000000, 20],
        [2000000, 2400000, 25],
        [2400000, null, 30],
    ];

    public static function financialYear(CarbonInterface $on): string
    {
        $start = $on->month >= 4 ? $on->year : $on->year - 1;

        return $start . '-' . substr((string) ($start + 1), 2);
    }

    // April se March, isliye April me 12 aur March me 1 bachta hai
    public static function monthsLeftInFy(CarbonInterface $on): int
    {
        return $on->month >= 4 ? 16 - $on->month : 4 - $on->month;
    }

    /**
     * Is FY me kitne mahine salary milegi — joining se March tak, exit ho to wahan tak.
     * Feb me joda banda 12 mahine ki salary nahi kamayega, TDS bhi utne hi par lagega.
     */
    public static function payableMonths(
        ?CarbonInterface $joined,
        ?CarbonInterface $left,
        CarbonInterface $on
    ): int {
        $fyStart = $on->copy()->setDate($on->month >= 4 ? $on->year : $on->year - 1, 4, 1)->startOfDay();
        $fyEnd = $fyStart->copy()->addMonthsNoOverflow(11);

        $from = $joined !== null && $joined->copy()->startOfMonth()->greaterThan($fyStart)
            ? $joined->copy()->startOfMonth()
            : $fyStart;

        $to = $left !== null && $left->copy()->startOfMonth()->lessThan($fyEnd)
            ? $left->copy()->startOfMonth()
            : $fyEnd;

        if ($from->greaterThan($to)) {
            return 0;
        }

        return (int) $from->diffInMonths($to) + 1;
    }

    public static function slabBreakup(float $netTaxable): array
    {
        $rows = [];

        foreach (self::SLABS as [$from, $to, $percent]) {
            $upper = $to === null ? $netTaxable : min($netTaxable, (float) $to);
            $slice = max(0.0, $upper - (float) $from);

            $rows[] = [
                'from' => (float) $from,
                'to' => $to === null ? null : (float) $to,
                'percent' => (float) $percent,
                'taxable' => round($slice, 2),
                'tax' => round($slice * $percent / 100, 2),
            ];
        }

        return $rows;
    }

    public static function taxOn(float $netTaxable): array
    {
        $netTaxable = round(max(0.0, $netTaxable), 2);
        $rows = self::slabBreakup($netTaxable);
        $base = round(array_sum(array_column($rows, 'tax')), 2);

        $rebate = 0.0;

        if ($netTaxable <= self::REBATE_LIMIT) {
            $rebate = min($base, self::REBATE_CAP);
        }

        $afterRebate = round($base - $rebate, 2);

        // Marginal relief — 12L ke thoda upar wale par tax badhotri se zyada na ho
        $excess = round($netTaxable - self::REBATE_LIMIT, 2);
        $relief = 0.0;

        if ($excess > 0 && $afterRebate > $excess) {
            $relief = round($afterRebate - $excess, 2);
            $afterRebate = $excess;
        }

        $cess = round($afterRebate * self::CESS_PERCENT / 100, 2);

        return [
            'slabs' => $rows,
            'tax_before_rebate' => $base,
            'rebate' => $rebate,
            'marginal_relief' => $relief,
            'tax_after_rebate' => $afterRebate,
            'cess' => $cess,
            'total' => round($afterRebate + $cess, 2),
        ];
    }

    public static function project(
        float $annualTaxableSalary,
        float $deductedTillDate,
        CarbonInterface $on,
        float $standardDeduction = self::STANDARD_DEDUCTION
    ): array {
        $annual = round(max(0.0, $annualTaxableSalary), 2);
        $netTaxable = round(max(0.0, $annual - $standardDeduction), 2);
        $tax = self::taxOn($netTaxable);

        $left = max(1, self::monthsLeftInFy($on));
        $remaining = round(max(0.0, $tax['total'] - $deductedTillDate), 2);
        $monthly = round($remaining / $left, 2);

        return [
            'financial_year' => self::financialYear($on),
            'regime' => self::NEW_REGIME,
            'annual_taxable_salary' => $annual,
            'standard_deduction' => round($standardDeduction, 2),
            'net_taxable_income' => $netTaxable,
            'slabs' => $tax['slabs'],
            'tax_before_rebate' => $tax['tax_before_rebate'],
            'rebate' => $tax['rebate'],
            'marginal_relief' => $tax['marginal_relief'],
            'cess' => $tax['cess'],
            'annual_tax' => $tax['total'],
            'deducted_till_date' => round($deductedTillDate, 2),
            'remaining_tax' => $remaining,
            'months_left' => $left,
            'monthly_tds' => $monthly,
        ];
    }
}

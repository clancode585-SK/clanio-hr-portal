<?php

declare(strict_types=1);

namespace App\Support;

final class Money
{
    public static function indian(float|int|string|null $value, int $decimals = 0): string
    {
        $amount = round((float) $value, $decimals);
        $negative = $amount < 0;
        $amount = abs($amount);

        $whole = (string) (int) floor($amount);
        $fraction = $decimals > 0
            ? '.' . str_pad((string) (int) round(($amount - floor($amount)) * (10 ** $decimals)), $decimals, '0', STR_PAD_LEFT)
            : '';

        if (strlen($whole) > 3) {
            $last = substr($whole, -3);
            $rest = substr($whole, 0, -3);
            $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest) ?? $rest;
            $whole = $rest . ',' . $last;
        }

        return ($negative ? '-' : '') . $whole . $fraction;
    }

    public static function inWords(float|int|string|null $value): string
    {
        $amount = round((float) $value, 2);
        $negative = $amount < 0;
        $amount = abs($amount);

        $rupees = (int) floor($amount);
        $paise = (int) round(($amount - $rupees) * 100);

        $words = $rupees === 0 ? 'Zero' : self::groups($rupees);
        $line = ($negative ? 'Minus ' : '') . $words . ' Rupee' . ($rupees === 1 ? '' : 's');

        if ($paise > 0) {
            $line .= ' and ' . self::groups($paise) . ' Paise';
        }

        return $line . ' Only';
    }

    private static function groups(int $number): string
    {
        $parts = [];

        foreach ([['Crore', 10000000], ['Lakh', 100000], ['Thousand', 1000], ['Hundred', 100]] as [$label, $size]) {
            if ($number >= $size) {
                $parts[] = self::underHundred(intdiv($number, $size)) . ' ' . $label;
                $number %= $size;
            }
        }

        if ($number > 0) {
            $parts[] = self::underHundred($number);
        }

        return implode(' ', $parts);
    }

    private static function underHundred(int $number): string
    {
        $ones = [
            1 => 'One', 2 => 'Two', 3 => 'Three', 4 => 'Four', 5 => 'Five', 6 => 'Six', 7 => 'Seven',
            8 => 'Eight', 9 => 'Nine', 10 => 'Ten', 11 => 'Eleven', 12 => 'Twelve', 13 => 'Thirteen',
            14 => 'Fourteen', 15 => 'Fifteen', 16 => 'Sixteen', 17 => 'Seventeen', 18 => 'Eighteen',
            19 => 'Nineteen',
        ];

        $tens = [
            2 => 'Twenty', 3 => 'Thirty', 4 => 'Forty', 5 => 'Fifty',
            6 => 'Sixty', 7 => 'Seventy', 8 => 'Eighty', 9 => 'Ninety',
        ];

        if ($number >= 100) {
            $rest = $number % 100;

            return $ones[intdiv($number, 100)] . ' Hundred' . ($rest > 0 ? ' ' . self::underHundred($rest) : '');
        }

        if ($number < 20) {
            return $ones[$number] ?? '';
        }

        $unit = $number % 10;

        return $tens[intdiv($number, 10)] . ($unit > 0 ? ' ' . $ones[$unit] : '');
    }
}

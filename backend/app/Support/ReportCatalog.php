<?php

declare(strict_types=1);

namespace App\Support;

class ReportCatalog
{
    public const MONTH = 'month';

    public const YEAR = 'year';

    public const RANGE = 'range';

    public const FY = 'fy';

    public const NONE = 'none';

    /** Har report ka naam, kya deti hai aur kya param chahiye */
    public const REPORTS = [
        'attendance-register' => [
            'label' => 'Attendance Register',
            'hint' => 'Muster roll — har employee ka har din P / A / HD / L',
            'param' => self::MONTH,
            'group' => 'Attendance',
        ],
        'payroll-register' => [
            'label' => 'Payroll Register',
            'hint' => 'Everyone\'s salary for a month, component by component',
            'param' => self::MONTH,
            'group' => 'Payroll',
        ],
        'bank-transfer' => [
            'label' => 'Bank Transfer Sheet',
            'hint' => 'Account number, IFSC and amount — to hand to the bank',
            'param' => self::MONTH,
            'group' => 'Payroll',
        ],
        'pf-esi' => [
            'label' => 'PF / ESI Statement',
            'hint' => 'UAN, ESIC number, wages and both sides of the contribution',
            'param' => self::MONTH,
            'group' => 'Payroll',
        ],
        'advance-register' => [
            'label' => 'Advance Register',
            'hint' => 'Whose advance is running, how much is recovered, how much is left',
            'param' => self::NONE,
            'group' => 'Payroll',
        ],
        'form16-register' => [
            'label' => 'Form 16 Register',
            'hint' => 'Saal bhar ka — kiska Form 16 banega, kiska salary certificate',
            'param' => self::FY,
            'group' => 'Payroll',
        ],
        'leave-balance' => [
            'label' => 'Leave Balance',
            'hint' => 'Entitled, used and available for the year — per leave type',
            'param' => self::YEAR,
            'group' => 'Leave',
        ],
        'employee-master' => [
            'label' => 'Employee Master',
            'hint' => 'Poori directory — joining date, department, manager, statutory',
            'param' => self::NONE,
            'group' => 'People',
        ],
        'expense-payout' => [
            'label' => 'Expense Payout',
            'hint' => 'Claims — what was verified, what was paid',
            'param' => self::RANGE,
            'group' => 'Expense',
        ],
    ];

    public static function has(string $key): bool
    {
        return array_key_exists($key, self::REPORTS);
    }

    public static function get(string $key): array
    {
        return self::REPORTS[$key];
    }

    public static function listing(): array
    {
        $out = [];

        foreach (self::REPORTS as $key => $row) {
            $out[] = [
                'key' => $key,
                'label' => $row['label'],
                'hint' => $row['hint'],
                'param' => $row['param'],
                'group' => $row['group'],
            ];
        }

        return $out;
    }
}

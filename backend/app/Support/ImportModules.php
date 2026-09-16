<?php

declare(strict_types=1);

namespace App\Support;

final class ImportModules
{
    public const STEP_FOUNDATION = 'foundation';

    public const STEP_STRUCTURE = 'structure';

    public const STEP_PEOPLE = 'people';

    public const STEP_RECORDS = 'records';

    public static function all(): array
    {
        return [
            'departments' => [
                'label' => 'Departments',
                'step' => self::STEP_FOUNDATION,
                'permission' => 'department.create',
                'match_on' => 'code',
                'hint' => 'Technology, Sales, Human Resources',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:150', 'note' => 'Technology'],
                    'code' => ['required' => true, 'rule' => 'string|max:30|regex:/^[A-Za-z0-9_-]+$/', 'note' => 'TECH — unique, used to match on re-import'],
                    'description' => ['required' => false, 'note' => 'Optional'],
                ],
            ],
            'designations' => [
                'label' => 'Designations',
                'step' => self::STEP_FOUNDATION,
                'permission' => 'designation.create',
                'match_on' => 'code',
                'hint' => 'The job titles people are hired into',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:150', 'note' => 'Software Engineer'],
                    'code' => ['required' => true, 'rule' => 'string|max:30|regex:/^[A-Za-z0-9_-]+$/', 'note' => 'SE'],
                    'level' => ['required' => false, 'rule' => 'integer|between:1,20', 'note' => 'A number, 1 is most senior'],
                ],
            ],
            'branches' => [
                'label' => 'Branches',
                'step' => self::STEP_FOUNDATION,
                'permission' => 'branch.create',
                'match_on' => 'code',
                'hint' => 'Your office locations',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:150', 'note' => 'Mumbai Office'],
                    'code' => ['required' => true, 'rule' => 'string|max:30|regex:/^[A-Za-z0-9_-]+$/', 'note' => 'MUM'],
                    'address' => ['required' => false, 'note' => 'Optional'],
                    'city' => ['required' => false, 'note' => 'Optional'],
                    'phone' => ['required' => false, 'note' => 'Optional'],
                    'email' => ['required' => false, 'rule' => 'email|max:255', 'note' => 'Optional'],
                ],
            ],
            'work_shifts' => [
                'label' => 'Work Shifts',
                'step' => self::STEP_FOUNDATION,
                'permission' => 'work_shift.create',
                'match_on' => 'code',
                'hint' => 'Office hours, grace time and weekly offs',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:150', 'note' => 'General Shift'],
                    'code' => ['required' => true, 'rule' => 'string|max:30|regex:/^[A-Za-z0-9_-]+$/', 'note' => 'GEN'],
                    'start_time' => ['required' => true, 'note' => '09:30'],
                    'end_time' => ['required' => true, 'note' => '18:30'],
                    'weekly_offs' => ['required' => true, 'note' => '0,6 — Sunday is 0, Saturday is 6'],
                    'grace_minutes' => ['required' => false, 'rule' => 'integer|between:0,240', 'note' => '15'],
                ],
            ],
            'leave_types' => [
                'label' => 'Leave Types',
                'step' => self::STEP_FOUNDATION,
                'permission' => 'leave_type.create',
                'match_on' => 'code',
                'hint' => 'Casual, sick, earned leave',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:100', 'note' => 'Casual Leave'],
                    'code' => ['required' => true, 'rule' => 'string|max:20|regex:/^[A-Za-z0-9_-]+$/', 'note' => 'CL'],
                    'annual_quota' => ['required' => false, 'rule' => 'numeric|between:0,365', 'note' => '12'],
                    'accrual_type' => ['required' => false, 'rule' => 'in:yearly,monthly', 'note' => 'yearly or monthly'],
                    'is_paid' => ['required' => false, 'note' => 'yes or no'],
                ],
            ],
            'holidays' => [
                'label' => 'Holidays',
                'step' => self::STEP_FOUNDATION,
                'permission' => 'holiday.create',
                'match_on' => 'holiday_date',
                'hint' => 'The whole year calendar in one go',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:150', 'note' => 'Republic Day'],
                    'holiday_date' => ['required' => true, 'note' => '2027-01-26'],
                    'type' => ['required' => false, 'rule' => 'in:public,optional,restricted', 'note' => 'public, optional or restricted'],
                    'is_paid' => ['required' => false, 'note' => 'yes or no'],
                ],
            ],
            'teams' => [
                'label' => 'Teams',
                'step' => self::STEP_STRUCTURE,
                'permission' => 'team.create',
                'match_on' => 'code',
                'needs' => ['departments'],
                'hint' => 'Teams sit inside a department',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:150', 'note' => 'Backend Squad'],
                    'code' => ['required' => true, 'rule' => 'string|max:30|regex:/^[A-Za-z0-9_-]+$/', 'note' => 'BE'],
                    'department_code' => ['required' => true, 'note' => 'TECH — must already exist'],
                    'description' => ['required' => false, 'note' => 'Optional'],
                ],
            ],
            'employees' => [
                'label' => 'Employees',
                'step' => self::STEP_PEOPLE,
                'permission' => 'employee.create',
                'match_on' => 'email',
                'needs' => ['departments', 'designations', 'work_shifts'],
                'hint' => 'Their login is created with the password you set here',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:150', 'note' => 'Neha Sharma'],
                    'email' => ['required' => true, 'rule' => 'email|max:255', 'note' => 'neha@acme.com — used to match on re-import'],
                    'password' => ['required' => false, 'rule' => 'string|min:8', 'note' => 'Blank means Welcome@123'],
                    'phone' => ['required' => false, 'note' => 'Optional'],
                    'role_slug' => ['required' => true, 'note' => 'member, team_lead, manager'],
                    'department_code' => ['required' => false, 'note' => 'TECH'],
                    'team_code' => ['required' => false, 'note' => 'BE'],
                    'branch_code' => ['required' => false, 'note' => 'MUM'],
                    'designation_code' => ['required' => false, 'note' => 'SE'],
                    'shift_code' => ['required' => false, 'note' => 'GEN'],
                    'manager_email' => ['required' => false, 'rule' => 'email', 'note' => 'Who they report to'],
                    'date_of_joining' => ['required' => true, 'note' => '2026-01-05'],
                    'employment_type' => ['required' => false, 'rule' => 'in:full_time,part_time,intern,contract,consultant', 'note' => 'full_time, part_time, intern, contract'],
                    'gender' => ['required' => false, 'rule' => 'in:male,female,other', 'note' => 'male, female, other'],
                    'date_of_birth' => ['required' => false, 'note' => '1996-04-12'],
                ],
            ],
            'leave_balances' => [
                'label' => 'Leave Balances',
                'step' => self::STEP_RECORDS,
                'permission' => 'leave_balance.manage',
                'match_on' => 'composite',
                'needs' => ['employees', 'leave_types'],
                'hint' => 'Opening balances carried over from your old system',
                'columns' => [
                    'employee_email' => ['required' => true, 'note' => 'neha@acme.com'],
                    'leave_code' => ['required' => true, 'note' => 'CL'],
                    'year' => ['required' => true, 'rule' => 'integer|between:2000,2100', 'note' => '2026'],
                    'opening' => ['required' => false, 'rule' => 'numeric|between:0,365', 'note' => '5'],
                    'used' => ['required' => false, 'rule' => 'numeric|between:0,365', 'note' => '2'],
                ],
            ],
            'attendance' => [
                'label' => 'Attendance',
                'step' => self::STEP_RECORDS,
                'permission' => 'attendance.regularize',
                'match_on' => 'composite',
                'needs' => ['employees'],
                'hint' => 'Past punch records, one row per day',
                'columns' => [
                    'employee_email' => ['required' => true, 'note' => 'neha@acme.com'],
                    'attendance_date' => ['required' => true, 'note' => '2026-08-01'],
                    'check_in' => ['required' => false, 'note' => '09:28'],
                    'check_out' => ['required' => false, 'note' => '18:41'],
                    'status' => ['required' => false, 'rule' => 'in:present,absent,half_day,leave,holiday,week_off', 'note' => 'present, absent, half_day, leave, holiday, week_off'],
                ],
            ],
            'assets' => [
                'label' => 'IT Assets',
                'step' => self::STEP_RECORDS,
                'permission' => 'asset.manage',
                'match_on' => 'asset_code',
                'hint' => 'Laptops, SIM cards, access cards',
                'columns' => [
                    'name' => ['required' => true, 'rule' => 'string|max:150', 'note' => 'MacBook Air M2'],
                    'category' => ['required' => true, 'rule' => 'in:laptop,desktop,monitor,mobile,sim,headset,keyboard,id_card,access_card,other', 'note' => 'laptop, desktop, monitor, mobile, sim, headset, keyboard, id_card, access_card, other'],
                    'asset_code' => ['required' => false, 'note' => 'Blank means auto generated'],
                    'brand' => ['required' => false, 'note' => 'Apple'],
                    'model' => ['required' => false, 'note' => 'A2681'],
                    'serial_number' => ['required' => false, 'note' => 'Unique per company'],
                    'purchase_date' => ['required' => false, 'note' => '2026-02-10'],
                    'purchase_cost' => ['required' => false, 'rule' => 'numeric|min:0', 'note' => '95000'],
                    'holder_email' => ['required' => false, 'rule' => 'email', 'note' => 'Who is holding it right now'],
                ],
            ],
        ];
    }

    public static function find(string $module): ?array
    {
        return self::all()[$module] ?? null;
    }

    public static function headers(string $module): array
    {
        $definition = self::find($module);

        return $definition === null ? [] : array_keys($definition['columns']);
    }

    public static function sampleRow(string $module): array
    {
        $definition = self::find($module);

        if ($definition === null) {
            return [];
        }

        return array_map(
            static fn (array $column): string => (string) ($column['note'] ?? ''),
            $definition['columns']
        );
    }
}

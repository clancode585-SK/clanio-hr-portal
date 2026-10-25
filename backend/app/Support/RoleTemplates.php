<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Har naye company ke sath ye 5 role apne aap ban jaate hain.
 * Admin baad me inko edit ya naye role bana sakta hai — ye sirf ek shuruaati,
 * kaam-chalau set hai taaki din 1 se hi sab role kaam kar sakein.
 */
final class RoleTemplates
{
    /** Apna profile, apna bank, apna document — ye har role ko milta hai, tier chahe jo bhi ho */
    private const BASELINE = [
        'employee.view',
        'employee_family.view',
        'employee_family.manage',
        'employee_bank.view',
        'employee_bank.manage',
        'employee_document.view',
        'user.view',
    ];

    /** @return array<string, array{name: string, hierarchy_level: int, data_scope: string, permissions: string[]}> */
    public static function defaults(): array
    {
        $tiers = [
            'member' => [
                'name' => 'Member',
                'hierarchy_level' => 8,
                'data_scope' => 'self',
                'permissions' => [],
            ],

            'team_lead' => [
                'name' => 'Team Lead',
                'hierarchy_level' => 5,
                'data_scope' => 'team',
                'permissions' => [
                    'team.view',
                    'attendance.regularize',
                    'leave.approve',
                    'daily_report.view_team',
                    'task.edit',
                    'recognition.give',
                    'interview.conduct',
                    'recruitment.request',
                    'ticket.assign',
                    'ticket.resolve',
                ],
            ],

            'manager' => [
                'name' => 'Manager',
                'hierarchy_level' => 4,
                'data_scope' => 'department',
                'permissions' => [
                    'team.view',
                    'attendance.regularize',
                    'leave.approve',
                    'daily_report.view_team',
                    'task.edit',
                    'okr.verify',
                    'recognition.give',
                    'clearance.sign',
                    'interview.conduct',
                    'recruitment.request',
                ],
            ],

            'hr_manager' => [
                'name' => 'HR Manager',
                'hierarchy_level' => 3,
                'data_scope' => 'all_company',
                'permissions' => [
                    'employee.create', 'employee.edit',
                    'employee_document.manage', 'employee_document.verify',
                    'department.view', 'designation.view', 'team.view',
                    'user.view_all', 'role.view',
                    'attendance.regularize',
                    'leave_type.view', 'leave_type.create', 'leave_type.edit', 'leave_type.delete',
                    'leave_balance.view', 'leave_balance.manage', 'leave.approve',
                    'holiday.view', 'holiday.create', 'holiday.edit', 'holiday.delete',
                    'work_shift.view', 'work_shift.create', 'work_shift.edit',
                    'daily_report.view_team', 'task.edit', 'task.delete',
                    'exit.approve', 'exit.document', 'clearance.manage', 'clearance.sign',
                    'expense.verify', 'expense.pay',
                    'policy.manage', 'notification.send',
                    'recruitment.view', 'recruitment.manage', 'recruitment.career_page',
                    'recruitment.offer', 'recruitment.request', 'interview.conduct',
                    'performance.manage', 'performance.finalise', 'okr.verify',
                    'incentive.manage', 'incentive.approve', 'recognition.give',
                    'ticket.view_all', 'ticket.assign', 'ticket.resolve', 'ticket.category_manage',
                    'payroll.view', 'salary_structure.view',
                    'advance.view', 'advance.approve',
                ],
            ],

            // company_admin ko har non-platform permission milti hai — isse alag
            // hard-code karne ki zaroorat nahi, CompanyService me wahi logic hai.
        ];

        foreach ($tiers as &$tier) {
            $tier['permissions'] = array_values(array_unique(array_merge(self::BASELINE, $tier['permissions'])));
        }

        return $tiers;
    }
}

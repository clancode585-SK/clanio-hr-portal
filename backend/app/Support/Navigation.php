<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\User;

/**
 * Sidebar ka ek hi sach — ye list jahan badlegi, sabke liye badal jayegi.
 * Frontend sirf isko fetch karke dikhata hai, khud koi permission check nahi karta.
 */
final class Navigation
{
    /** @return array<int, array{id: string, label: string, icon: string, solo?: bool, platformOnly?: bool, items?: array<int, array{id: string, label: string, permissions: string[], selfService?: bool}>}> */
    public static function groups(): array
    {
        return [
            ['id' => 'dashboard', 'label' => 'Dashboard', 'icon' => 'grid', 'solo' => true],

            [
                'id' => 'platform',
                'label' => 'Platform',
                'icon' => 'building',
                'platformOnly' => true,
                'items' => [
                    ['id' => 'companies', 'label' => 'Companies', 'permissions' => []],
                    ['id' => 'plans', 'label' => 'Plans', 'permissions' => ['plan.manage']],
                    ['id' => 'invoices', 'label' => 'Invoices', 'permissions' => ['invoice.view']],
                ],
            ],

            [
                'id' => 'workforce',
                'label' => 'Workforce',
                'icon' => 'users',
                'items' => [
                    ['id' => 'employees', 'label' => 'Employees', 'permissions' => ['employee.edit']],
                    ['id' => 'users', 'label' => 'Users', 'permissions' => ['user.view_all']],
                    ['id' => 'departments', 'label' => 'Departments', 'permissions' => ['department.view']],
                    ['id' => 'designations', 'label' => 'Designations', 'permissions' => ['designation.view']],
                    ['id' => 'branches', 'label' => 'Branches', 'permissions' => ['branch.view']],
                    ['id' => 'teams', 'label' => 'Teams', 'permissions' => ['team.view']],
                    ['id' => 'roles', 'label' => 'Roles', 'permissions' => ['role.view']],
                    ['id' => 'org-chart', 'label' => 'Org Chart', 'permissions' => ['employee.view']],
                ],
            ],

            [
                'id' => 'attendance',
                'label' => 'Attendance',
                'icon' => 'clock',
                'items' => [
                    ['id' => 'attendance-log', 'label' => 'Attendance Log', 'permissions' => ['attendance.regularize']],
                    ['id' => 'regularizations', 'label' => 'Regularizations', 'permissions' => ['attendance.regularize']],
                    ['id' => 'shift-management', 'label' => 'Shift Management', 'permissions' => ['work_shift.view']],
                    ['id' => 'holidays', 'label' => 'Holidays', 'permissions' => ['holiday.view']],
                ],
            ],

            [
                'id' => 'leave',
                'label' => 'Leave',
                'icon' => 'calendar',
                'items' => [
                    ['id' => 'leave-requests', 'label' => 'Leave Requests', 'permissions' => ['leave.approve']],
                    ['id' => 'leave-balance', 'label' => 'Leave Balance', 'permissions' => ['leave_balance.view']],
                    ['id' => 'leave-types', 'label' => 'Leave Types', 'permissions' => ['leave_type.view']],
                ],
            ],

            [
                'id' => 'performance',
                'label' => 'Performance',
                'icon' => 'trending-up',
                'items' => [
                    ['id' => 'goals', 'label' => 'Goals & OKRs', 'permissions' => ['okr.verify', 'performance.manage']],
                    ['id' => 'appraisals', 'label' => 'Appraisals', 'permissions' => ['performance.manage', 'performance.finalise']],
                    ['id' => 'incentives', 'label' => 'Incentives', 'permissions' => ['incentive.approve', 'incentive.manage']],
                    ['id' => 'recognitions', 'label' => 'Recognitions', 'permissions' => ['recognition.give']],
                ],
            ],

            [
                'id' => 'payroll',
                'label' => 'Payroll',
                'icon' => 'wallet',
                'items' => [
                    ['id' => 'payroll-runs', 'label' => 'Payroll Runs', 'permissions' => ['payroll.view']],
                    ['id' => 'fnf', 'label' => 'Full & Final', 'permissions' => ['fnf.view']],
                    ['id' => 'advances', 'label' => 'Salary Advance', 'permissions' => ['advance.view']],
                    ['id' => 'salary-components', 'label' => 'Salary Components', 'permissions' => ['salary_structure.view']],
                    ['id' => 'company-bank', 'label' => 'Company Bank', 'permissions' => ['company_bank.view']],
                ],
            ],

            [
                'id' => 'tasks',
                'label' => 'Tasks',
                'icon' => 'check-square',
                'items' => [
                    ['id' => 'my-tasks', 'label' => 'My Tasks', 'permissions' => []],
                    ['id' => 'daily-reports', 'label' => 'Daily Reports', 'permissions' => ['daily_report.view_team']],
                    ['id' => 'work-records', 'label' => 'Work Records', 'permissions' => ['daily_report.view_team']],
                ],
            ],

            [
                'id' => 'exits',
                'label' => 'Exits & Offboarding',
                'icon' => 'user-minus',
                'items' => [
                    ['id' => 'exits', 'label' => 'Resignations', 'permissions' => ['exit.approve']],
                    ['id' => 'clearance', 'label' => 'Clearance Sign-off', 'permissions' => ['clearance.sign']],
                    ['id' => 'clearance-items', 'label' => 'Clearance Checklist', 'permissions' => ['clearance.manage']],
                ],
            ],

            [
                'id' => 'expenses',
                'label' => 'Expenses & Claims',
                'icon' => 'receipt',
                'items' => [
                    ['id' => 'expense-claims', 'label' => 'Expense Claims', 'permissions' => ['expense.verify', 'expense.pay']],
                ],
            ],

            [
                'id' => 'assets',
                'label' => 'Assets',
                'icon' => 'briefcase',
                'items' => [
                    ['id' => 'company-assets', 'label' => 'Company Assets', 'permissions' => ['asset.manage']],
                    ['id' => 'asset-requests', 'label' => 'Asset Requests', 'permissions' => ['asset.manage', 'asset.support']],
                ],
            ],

            [
                'id' => 'recruitment',
                'label' => 'Recruitment',
                'icon' => 'briefcase',
                'items' => [
                    ['id' => 'openings', 'label' => 'Openings', 'permissions' => ['recruitment.view']],
                    ['id' => 'interviews', 'label' => 'Interviews', 'permissions' => ['interview.conduct']],
                    ['id' => 'joinings', 'label' => 'Joinings', 'permissions' => ['recruitment.view']],
                ],
            ],

            [
                'id' => 'reports',
                'label' => 'Reports & Billing',
                'icon' => 'file-text',
                'items' => [
                    ['id' => 'reports', 'label' => 'Reports', 'permissions' => ['report.view']],
                    ['id' => 'statutory-returns', 'label' => 'Statutory Returns', 'permissions' => ['report.view']],
                    ['id' => 'form16', 'label' => 'Form 16', 'permissions' => ['payroll.view']],
                    ['id' => 'billing', 'label' => 'Billing', 'permissions' => ['invoice.view']],
                ],
            ],

            [
                'id' => 'my-space',
                'label' => 'My Space',
                'icon' => 'user',
                'items' => [
                    ['id' => 'my-attendance', 'label' => 'My Attendance', 'permissions' => [], 'selfService' => true],
                    ['id' => 'my-leave', 'label' => 'My Leave', 'permissions' => [], 'selfService' => true],
                    ['id' => 'my-payslips', 'label' => 'My Payslips', 'permissions' => [], 'selfService' => true],
                    ['id' => 'my-advance', 'label' => 'My Advance', 'permissions' => [], 'selfService' => true],
                    ['id' => 'my-expenses', 'label' => 'My Expense Claims', 'permissions' => [], 'selfService' => true],
                    ['id' => 'my-assets', 'label' => 'My Asset Requests', 'permissions' => [], 'selfService' => true],
                    ['id' => 'my-tickets', 'label' => 'My Tickets', 'permissions' => [], 'selfService' => true],
                    ['id' => 'my-requests', 'label' => 'My Requests', 'permissions' => [], 'selfService' => true],
                    ['id' => 'my-policies', 'label' => 'My Policies', 'permissions' => []],
                ],
            ],

            [
                'id' => 'documents',
                'label' => 'Documents',
                'icon' => 'folder',
                'items' => [
                    ['id' => 'employee-documents', 'label' => 'Employee Documents', 'permissions' => ['employee_document.view']],
                    ['id' => 'company-policies', 'label' => 'Company Policies', 'permissions' => ['policy.manage']],
                ],
            ],

            [
                'id' => 'communication',
                'label' => 'Communication',
                'icon' => 'bell',
                'items' => [
                    ['id' => 'notifications', 'label' => 'Notifications', 'permissions' => []],
                    ['id' => 'announcements', 'label' => 'Announcements', 'permissions' => ['notification.send']],
                ],
            ],

            [
                'id' => 'helpdesk',
                'label' => 'Help Desk',
                'icon' => 'headset',
                'items' => [
                    ['id' => 'tickets', 'label' => 'Tickets', 'permissions' => ['ticket.view_all', 'ticket.resolve']],
                    ['id' => 'ticket-categories', 'label' => 'Ticket Categories', 'permissions' => ['ticket.category_manage']],
                ],
            ],

            [
                'id' => 'administration',
                'label' => 'Administration',
                'icon' => 'shield',
                'items' => [
                    ['id' => 'permissions', 'label' => 'Permissions', 'permissions' => ['user.permission', 'permission.view']],
                    ['id' => 'department-defaults', 'label' => 'Department Defaults', 'permissions' => ['user.permission']],
                    ['id' => 'audit-log', 'label' => 'Audit Log', 'permissions' => ['audit.view']],
                    ['id' => 'company-settings', 'label' => 'Company Settings', 'permissions' => ['company.view']],
                ],
            ],
        ];
    }

    /** Super admin kisi company ka nahi hota — usko sirf platform-wide screen dikhti hain */
    public static function visibleFor(User $user): array
    {
        $isSuperAdmin = (bool) $user->is_super_admin;
        $permissions = $user->permissionSlugs();

        $allowed = function (array $item) use ($permissions): bool {
            if ($item['permissions'] === []) {
                return true;
            }

            return count(array_intersect($item['permissions'], $permissions)) > 0;
        };

        $groups = array_values(array_filter(
            self::groups(),
            fn (array $group): bool => $isSuperAdmin ? ($group['platformOnly'] ?? false) : ! ($group['platformOnly'] ?? false)
        ));

        $groups = array_map(function (array $group) use ($allowed) {
            if (($group['solo'] ?? false) || ! isset($group['items'])) {
                return $group;
            }

            $group['items'] = array_values(array_filter($group['items'], $allowed));

            return $group;
        }, $groups);

        return array_values(array_filter(
            $groups,
            fn (array $group): bool => ($group['solo'] ?? false) || count($group['items'] ?? []) > 0
        ));
    }
}

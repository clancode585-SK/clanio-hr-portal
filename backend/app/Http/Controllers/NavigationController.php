<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NavigationController extends Controller
{
    public function getSidebarMenu(Request $request): JsonResponse
    {
        $user = $request->user();

        $masterMenuItems = [
            [
                'id' => 'dashboard',
                'label' => 'Dashboard',
                'iconPath' => '/images/icons/dashboard.png',
            ],
            [
                'id' => 'workforce',
                'label' => 'Workforce',
                'iconPath' => '/images/icons/teamwork.png',
                'subItems' => [
                    ['id' => 'companies', 'label' => 'Companies', 'superAdminOnly' => true],
                    ['id' => 'branches', 'label' => 'Branches', 'permission' => 'branch.view'],
                    ['id' => 'employees', 'label' => 'Employees', 'permission' => 'employee.view'],
                    ['id' => 'departments', 'label' => 'Departments', 'permission' => 'department.view'],
                    ['id' => 'teams', 'label' => 'Teams', 'permission' => 'team.view', 'hideFromSuperAdmin' => true],
                    ['id' => 'designations', 'label' => 'Designations', 'permission' => 'designation.view'],
                    ['id' => 'organization-chart', 'label' => 'Organization Chart'],
                ],
            ],
            [
                'id' => 'attendance',
                'label' => 'Attendance',
                'iconPath' => '/images/icons/calendar.png',
                'badge' => ['text' => 'Today', 'variant' => 'emerald'],
                'subItems' => [
                    ['id' => 'attendance-list', 'label' => 'Attendance'],
                    ['id' => 'shift-management', 'label' => 'Shift Management', 'permission' => 'shift.view'],
                    ['id' => 'holidays', 'label' => 'Holidays'],
                    ['id' => 'timesheets', 'label' => 'Timesheets'],
                ],
            ],
            [
                'id' => 'leave',
                'label' => 'Leave',
                'iconPath' => '/images/icons/calendar.png',
                'subItems' => [
                    ['id' => 'leave-requests', 'label' => 'Leave Requests'],
                    ['id' => 'leave-balance', 'label' => 'Leave Balance'],
                    ['id' => 'leave-policies', 'label' => 'Leave Policies'],
                ],
            ],
            [
                'id' => 'payroll',
                'label' => 'Payroll',
                'iconPath' => '/images/icons/wages.png',
                'badge' => ['text' => 'Pending', 'variant' => 'amber'],
                'subItems' => [
                    ['id' => 'payroll-overview', 'label' => 'Payroll'],
                    ['id' => 'salary-structure', 'label' => 'Salary Structure'],
                    ['id' => 'payslips', 'label' => 'Payslips'],
                    ['id' => 'reimbursements', 'label' => 'Reimbursements'],
                    ['id' => 'loans-advances', 'label' => 'Loans & Advances'],
                ],
            ],
            [
                'id' => 'recruitment',
                'label' => 'Recruitment',
                'iconPath' => '/images/icons/recruitment.png',
                'badge' => ['text' => '3 New', 'variant' => 'purple'],
                'subItems' => [
                    ['id' => 'jobs', 'label' => 'Jobs'],
                    ['id' => 'candidates', 'label' => 'Candidates'],
                    ['id' => 'interviews', 'label' => 'Interviews'],
                    ['id' => 'offers', 'label' => 'Offers'],
                ],
            ],
            [
                'id' => 'tasks',
                'label' => 'Tasks',
                'iconPath' => '/images/icons/task.png',
                'subItems' => [
                    ['id' => 'my-tasks', 'label' => 'My Tasks'],
                    ['id' => 'team-tasks', 'label' => 'Team Tasks'],
                    ['id' => 'projects', 'label' => 'Projects'],
                    ['id' => 'sod-eod', 'label' => 'SOD / EOD'],
                ],
            ],
            [
                'id' => 'documents',
                'label' => 'Documents',
                'iconPath' => '/images/icons/folders.png',
                'subItems' => [
                    ['id' => 'employee-documents', 'label' => 'Employee Documents'],
                    ['id' => 'company-policies', 'label' => 'Company Policies'],
                    ['id' => 'templates', 'label' => 'Templates'],
                ],
            ],
            [
                'id' => 'reports',
                'label' => 'Reports',
                'iconPath' => '/images/icons/seo-report.png',
                'subItems' => [
                    ['id' => 'hr-reports', 'label' => 'HR Reports'],
                    ['id' => 'attendance-reports', 'label' => 'Attendance Reports'],
                    ['id' => 'payroll-reports', 'label' => 'Payroll Reports'],
                    ['id' => 'analytics', 'label' => 'Analytics'],
                ],
            ],
            [
                'id' => 'communication',
                'label' => 'Communication',
                'iconPath' => '/images/icons/chat-bubbles.png',
                'badge' => ['text' => '12', 'variant' => 'cyan'],
                'subItems' => [
                    ['id' => 'announcements', 'label' => 'Announcements'],
                    ['id' => 'notifications', 'label' => 'Notifications'],
                    ['id' => 'calendar', 'label' => 'Calendar'],
                ],
            ],
            [
                'id' => 'administration',
                'label' => 'Administration',
                'iconPath' => '/images/icons/administration.png',
                'subItems' => [
                    ['id' => 'roles', 'label' => 'Roles', 'permission' => 'role.view'],
                    ['id' => 'users-roles', 'label' => 'Users & Roles', 'permission' => 'role.view'],
                    ['id' => 'company-settings', 'label' => 'Company Settings', 'superAdminOnly' => true],
                    ['id' => 'billing', 'label' => 'Billing', 'superAdminOnly' => true],
                    ['id' => 'audit-logs', 'label' => 'Audit Logs', 'superAdminOnly' => true],
                ],
            ],
            [
                'id' => 'help',
                'label' => 'Help',
                'iconPath' => '/images/icons/help.png',
            ],
        ];

        $mode = $request->query('mode', 'admin');

        $filteredMenu = [];

        foreach ($masterMenuItems as $item) {
            if ($mode === 'employee' && in_array($item['id'], ['workforce', 'recruitment', 'administration'], true)) {
                continue;
            }

            // Check top-level permission if defined
            if (!empty($item['superAdminOnly']) && !$user->isSuperAdmin()) {
                continue;
            }
            if (!empty($item['hideFromSuperAdmin']) && $user->isSuperAdmin()) {
                continue;
            }
            if (isset($item['permission']) && !$user->hasPermission($item['permission'])) {
                continue;
            }

            if (isset($item['subItems'])) {
                $allowedSubItems = array_values(array_filter($item['subItems'], function ($sub) use ($user) {
                    if (!empty($sub['superAdminOnly']) && !$user->isSuperAdmin()) {
                        return false;
                    }
                    if (!empty($sub['hideFromSuperAdmin']) && $user->isSuperAdmin()) {
                        return false;
                    }
                    if (isset($sub['permission']) && !$user->hasPermission($sub['permission'])) {
                        return false;
                    }
                    return true;
                }));

                // Omit clean array parameters internal flags before returning JSON
                $cleanSubItems = array_map(function ($sub) {
                    unset($sub['permission'], $sub['superAdminOnly'], $sub['hideFromSuperAdmin']);
                    return $sub;
                }, $allowedSubItems);

                if (count($cleanSubItems) > 0) {
                    $item['subItems'] = $cleanSubItems;
                    unset($item['permission'], $item['superAdminOnly'], $item['hideFromSuperAdmin']);
                    $filteredMenu[] = $item;
                }
            } else {
                unset($item['permission'], $item['superAdminOnly'], $item['hideFromSuperAdmin']);
                $filteredMenu[] = $item;
            }
        }

        return ApiResponse::success(['menu' => $filteredMenu], 'Navigation menu fetched successfully.');
    }
}

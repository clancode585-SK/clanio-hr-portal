<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Company\AppraisalController;
use App\Http\Controllers\Company\AssetController;
use App\Http\Controllers\Company\AssetRequestController;
use App\Http\Controllers\Company\AttendanceController;
use App\Http\Controllers\Company\BranchController;
use App\Http\Controllers\Company\CompanyController;
use App\Http\Controllers\Company\ClearanceController;
use App\Http\Controllers\Company\CompanySettingController;
use App\Http\Controllers\Company\DailyReportController;
use App\Http\Controllers\Company\DepartmentController;
use App\Http\Controllers\Company\DesignationController;
use App\Http\Controllers\Company\DeviceTokenController;
use App\Http\Controllers\Company\EmployeeBankAccountController;
use App\Http\Controllers\Company\EmployeeController;
use App\Http\Controllers\Company\EmployeeDocumentController;
use App\Http\Controllers\Company\EmployeeExitController;
use App\Http\Controllers\Company\EmployeeFamilyController;
use App\Http\Controllers\Company\ExitDocumentController;
use App\Http\Controllers\Company\ExpenseBillController;
use App\Http\Controllers\Company\ExpenseClaimController;
use App\Http\Controllers\Company\HolidayController;
use App\Http\Controllers\Company\LeaveBalanceController;
use App\Http\Controllers\Company\LeaveController;
use App\Http\Controllers\Company\LeaveTypeController;
use App\Http\Controllers\Company\NotificationController;
use App\Http\Controllers\Company\PerformanceController;
use App\Http\Controllers\Company\PerformanceGoalController;
use App\Http\Controllers\Company\PolicyController;
use App\Http\Controllers\Company\RealtimeController;
use App\Http\Controllers\Company\RegularizationController;
use App\Http\Controllers\Company\RoleController;
use App\Http\Controllers\Company\TaskAttachmentController;
use App\Http\Controllers\Company\TaskCommentController;
use App\Http\Controllers\Company\TaskController;
use App\Http\Controllers\Company\TeamController;
use App\Http\Controllers\Company\UserController;
use App\Http\Controllers\Company\UserPermissionController;
use App\Http\Controllers\Company\WorkRecordController;
use App\Http\Controllers\Company\WorkShiftController;
use App\Http\Controllers\Permission\PermissionController;
use App\Http\Controllers\Profile\ProfileController;
use Illuminate\Support\Facades\Route;

Route::prefix('hrms')->group(function (): void {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:sensitive');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:sensitive');

    Route::middleware(['auth:api', 'tenant', 'company.active', 'policy.gate', 'throttle:api'])->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/change-password', [AuthController::class, 'changePassword'])->middleware('throttle:sensitive');

        Route::get('profile', [ProfileController::class, 'show']);
        Route::get('profile/completion', [ProfileController::class, 'completion']);
        Route::put('profile', [ProfileController::class, 'update']);
        Route::post('profile/avatar', [ProfileController::class, 'uploadAvatar']);
        Route::delete('profile/avatar', [ProfileController::class, 'deleteAvatar']);
        Route::get('profile/documents', [ProfileController::class, 'documents']);
        Route::post('profile/documents', [ProfileController::class, 'uploadDocument']);
        Route::delete('profile/documents/{document}', [ProfileController::class, 'deleteDocument']);

        Route::get('documents/{document}/download', [EmployeeDocumentController::class, 'download'])
            ->name('documents.download');

        Route::middleware('super.admin')->group(function (): void {
            Route::get('companies', [CompanyController::class, 'index']);
            Route::post('companies', [CompanyController::class, 'store'])->middleware('throttle:sensitive');
            Route::get('companies/{company}', [CompanyController::class, 'show']);
            Route::put('companies/{company}', [CompanyController::class, 'update']);
            Route::delete('companies/{company}', [CompanyController::class, 'destroy']);
            Route::get('companies/{company}/modules', [UserPermissionController::class, 'modules']);
            Route::put('companies/{company}/modules', [UserPermissionController::class, 'setModules'])
                ->name('companies.modules');
        });

        Route::get('company-settings', [CompanySettingController::class, 'show'])->middleware('permission:company.view');
        Route::put('company-settings', [CompanySettingController::class, 'update'])->middleware('permission:company.edit');

        Route::get('permissions', [PermissionController::class, 'index'])->middleware('permission:permission.view');
        Route::get('permissions/tree', [UserPermissionController::class, 'tree'])
            ->middleware('permission:permission.view');

        Route::get('departments/{department}/permissions', [UserPermissionController::class, 'department'])
            ->middleware('permission:user.permission');
        Route::put('departments/{department}/permissions', [UserPermissionController::class, 'setDepartment'])
            ->middleware('permission:user.permission');

        Route::get('users/{user}/permissions', [UserPermissionController::class, 'show'])
            ->middleware('permission:user.permission');
        Route::put('users/{user}/permissions', [UserPermissionController::class, 'update'])
            ->middleware('permission:user.permission');
        Route::delete('users/{user}/permissions', [UserPermissionController::class, 'reset'])
            ->middleware('permission:user.permission');

        Route::get('branches', [BranchController::class, 'index'])->middleware('permission:branch.view');
        Route::post('branches', [BranchController::class, 'store'])->middleware('permission:branch.create');
        Route::get('branches/{branch}', [BranchController::class, 'show'])->middleware('permission:branch.view');
        Route::put('branches/{branch}', [BranchController::class, 'update'])->middleware('permission:branch.edit');
        Route::delete('branches/{branch}', [BranchController::class, 'destroy'])->middleware('permission:branch.delete');

        Route::get('departments', [DepartmentController::class, 'index'])->middleware('permission:department.view');
        Route::post('departments', [DepartmentController::class, 'store'])->middleware('permission:department.create');
        Route::get('departments/{department}', [DepartmentController::class, 'show'])->middleware('permission:department.view');
        Route::put('departments/{department}', [DepartmentController::class, 'update'])->middleware('permission:department.edit');
        Route::delete('departments/{department}', [DepartmentController::class, 'destroy'])->middleware('permission:department.delete');

        Route::get('teams', [TeamController::class, 'index'])->middleware('permission:team.view');
        Route::post('teams', [TeamController::class, 'store'])->middleware('permission:team.create');
        Route::get('teams/{team}', [TeamController::class, 'show'])->middleware('permission:team.view');
        Route::put('teams/{team}', [TeamController::class, 'update'])->middleware('permission:team.edit');
        Route::delete('teams/{team}', [TeamController::class, 'destroy'])->middleware('permission:team.delete');

        Route::get('designations', [DesignationController::class, 'index'])->middleware('permission:designation.view');
        Route::post('designations', [DesignationController::class, 'store'])->middleware('permission:designation.create');
        Route::get('designations/{designation}', [DesignationController::class, 'show'])->middleware('permission:designation.view');
        Route::put('designations/{designation}', [DesignationController::class, 'update'])->middleware('permission:designation.edit');
        Route::delete('designations/{designation}', [DesignationController::class, 'destroy'])->middleware('permission:designation.delete');

        Route::get('employees', [EmployeeController::class, 'index'])->middleware('permission:employee.view');
        Route::post('employees', [EmployeeController::class, 'store'])->middleware('permission:employee.create');
        Route::get('employees/{employee}', [EmployeeController::class, 'show'])->middleware('permission:employee.view');
        Route::put('employees/{employee}', [EmployeeController::class, 'update'])->middleware('permission:employee.edit');
        Route::delete('employees/{employee}', [EmployeeController::class, 'destroy'])->middleware('permission:employee.delete');
        Route::post('employees/{employee}/complete-onboarding', [EmployeeController::class, 'completeOnboarding'])
            ->middleware('permission:employee.edit');

        Route::prefix('employees/{employee}')->scopeBindings()->group(function (): void {
            Route::get('family', [EmployeeFamilyController::class, 'index'])->middleware('permission:employee_family.view');
            Route::post('family', [EmployeeFamilyController::class, 'store'])->middleware('permission:employee_family.manage');
            Route::get('family/{familyMember}', [EmployeeFamilyController::class, 'show'])->middleware('permission:employee_family.view');
            Route::put('family/{familyMember}', [EmployeeFamilyController::class, 'update'])->middleware('permission:employee_family.manage');
            Route::delete('family/{familyMember}', [EmployeeFamilyController::class, 'destroy'])->middleware('permission:employee_family.manage');

            Route::get('documents', [EmployeeDocumentController::class, 'index'])->middleware('permission:employee_document.view');
            Route::post('documents', [EmployeeDocumentController::class, 'store'])->middleware('permission:employee_document.manage');
            Route::get('documents/{document}', [EmployeeDocumentController::class, 'show'])->middleware('permission:employee_document.view');
            Route::put('documents/{document}/verify', [EmployeeDocumentController::class, 'verify'])->middleware('permission:employee_document.verify');
            Route::delete('documents/{document}', [EmployeeDocumentController::class, 'destroy'])->middleware('permission:employee_document.manage');

            Route::get('bank-accounts', [EmployeeBankAccountController::class, 'index'])->middleware('permission:employee_bank.view');
            Route::post('bank-accounts', [EmployeeBankAccountController::class, 'store'])->middleware('permission:employee_bank.manage');
            Route::get('bank-accounts/{bankAccount}', [EmployeeBankAccountController::class, 'show'])->middleware('permission:employee_bank.view');
            Route::put('bank-accounts/{bankAccount}', [EmployeeBankAccountController::class, 'update'])->middleware('permission:employee_bank.manage');
            Route::delete('bank-accounts/{bankAccount}', [EmployeeBankAccountController::class, 'destroy'])->middleware('permission:employee_bank.manage');
        });

        Route::get('work-shifts', [WorkShiftController::class, 'index'])->middleware('permission:work_shift.view');
        Route::post('work-shifts', [WorkShiftController::class, 'store'])->middleware('permission:work_shift.create');
        Route::get('work-shifts/{workShift}', [WorkShiftController::class, 'show'])->middleware('permission:work_shift.view');
        Route::put('work-shifts/{workShift}', [WorkShiftController::class, 'update'])->middleware('permission:work_shift.edit');
        Route::delete('work-shifts/{workShift}', [WorkShiftController::class, 'destroy'])->middleware('permission:work_shift.delete');

        Route::get('holidays', [HolidayController::class, 'index'])->middleware('permission:holiday.view');
        Route::post('holidays', [HolidayController::class, 'store'])->middleware('permission:holiday.create');
        Route::post('holidays/bulk', [HolidayController::class, 'storeMany'])->middleware('permission:holiday.create');
        Route::get('holidays/{holiday}', [HolidayController::class, 'show'])->middleware('permission:holiday.view');
        Route::put('holidays/{holiday}', [HolidayController::class, 'update'])->middleware('permission:holiday.edit');
        Route::delete('holidays/{holiday}', [HolidayController::class, 'destroy'])->middleware('permission:holiday.delete');

        Route::get('leave-types', [LeaveTypeController::class, 'index'])->middleware('permission:leave_type.view');
        Route::post('leave-types', [LeaveTypeController::class, 'store'])->middleware('permission:leave_type.create');
        Route::get('leave-types/{leaveType}', [LeaveTypeController::class, 'show'])->middleware('permission:leave_type.view');
        Route::put('leave-types/{leaveType}', [LeaveTypeController::class, 'update'])->middleware('permission:leave_type.edit');
        Route::delete('leave-types/{leaveType}', [LeaveTypeController::class, 'destroy'])->middleware('permission:leave_type.delete');

        Route::post('leave-balances/allocate', [LeaveBalanceController::class, 'allocate'])->middleware('permission:leave_balance.manage');
        Route::post('leave-balances/accrue', [LeaveBalanceController::class, 'accrue'])->middleware('permission:leave_balance.manage');
        Route::post('leave-balances/carry-forward', [LeaveBalanceController::class, 'carryForward'])->middleware('permission:leave_balance.manage');
        Route::get('leave-balances', [LeaveBalanceController::class, 'index'])->middleware('permission:leave_balance.view');
        Route::put('leave-balances/{leaveBalance}/adjust', [LeaveBalanceController::class, 'adjust'])->middleware('permission:leave_balance.manage');
        Route::put('leave-balances/{leaveBalance}/encash', [LeaveBalanceController::class, 'encash'])->middleware('permission:leave_balance.manage');

        Route::get('leaves/my-balance', [LeaveController::class, 'myBalance']);
        Route::get('leaves/calendar', [LeaveController::class, 'calendar']);
        Route::get('leaves/pending-approvals', [LeaveController::class, 'pendingApprovals']);
        Route::get('leaves', [LeaveController::class, 'index']);
        Route::post('leaves', [LeaveController::class, 'store']);
        Route::get('leaves/{leave}', [LeaveController::class, 'show']);
        Route::put('leaves/{leave}/approve', [LeaveController::class, 'approve']);
        Route::put('leaves/{leave}/reject', [LeaveController::class, 'reject']);
        Route::delete('leaves/{leave}', [LeaveController::class, 'destroy']);

        Route::post('attendance/check-in', [AttendanceController::class, 'checkIn']);
        Route::post('attendance/check-out', [AttendanceController::class, 'checkOut']);
        Route::get('attendance/today', [AttendanceController::class, 'today']);
        Route::get('attendance/calendar', [AttendanceController::class, 'calendar']);
        Route::get('attendance', [AttendanceController::class, 'index']);
        Route::get('attendance/{attendance}', [AttendanceController::class, 'show']);

        Route::get('regularizations/eligible-days', [RegularizationController::class, 'eligibleDays']);
        Route::get('regularizations/pending-approvals', [RegularizationController::class, 'pendingApprovals']);
        Route::get('regularizations/summary', [RegularizationController::class, 'summary']);
        Route::get('regularizations', [RegularizationController::class, 'index']);
        Route::post('regularizations', [RegularizationController::class, 'store']);
        Route::get('regularizations/{regularization}', [RegularizationController::class, 'show']);
        Route::put('regularizations/{regularization}/approve', [RegularizationController::class, 'approve'])->name('regularizations.approve');
        Route::put('regularizations/{regularization}/reject', [RegularizationController::class, 'reject'])->name('regularizations.reject');
        Route::delete('regularizations/{regularization}', [RegularizationController::class, 'destroy']);

        Route::get('tasks/summary', [TaskController::class, 'summary']);
        Route::get('tasks', [TaskController::class, 'index']);
        Route::post('tasks', [TaskController::class, 'store']);
        Route::get('tasks/{task}', [TaskController::class, 'show']);
        Route::put('tasks/{task}', [TaskController::class, 'update']);
        Route::put('tasks/{task}/status', [TaskController::class, 'changeStatus']);
        Route::delete('tasks/{task}', [TaskController::class, 'destroy']);

        Route::get('tasks/{task}/activity', [TaskController::class, 'activity']);

        Route::get('task-attachments/{attachment}/download', [TaskAttachmentController::class, 'download'])
            ->name('task-attachments.download');

        Route::prefix('tasks/{task}')->scopeBindings()->group(function (): void {
            Route::get('comments', [TaskCommentController::class, 'index']);
            Route::post('comments', [TaskCommentController::class, 'store']);
            Route::delete('comments/{comment}', [TaskCommentController::class, 'destroy']);

            Route::get('attachments', [TaskAttachmentController::class, 'index']);
            Route::post('attachments', [TaskAttachmentController::class, 'store']);
            Route::delete('attachments/{attachment}', [TaskAttachmentController::class, 'destroy']);
        });

        Route::get('work-record', [WorkRecordController::class, 'show']);
        Route::get('work-record/team', [WorkRecordController::class, 'team']);

        Route::get('daily-reports/today', [DailyReportController::class, 'today']);
        Route::get('daily-reports/team-status', [DailyReportController::class, 'teamStatus']);
        Route::post('daily-reports/sod', [DailyReportController::class, 'storeSod']);
        Route::post('daily-reports/eod', [DailyReportController::class, 'storeEod']);
        Route::get('daily-reports', [DailyReportController::class, 'index']);
        Route::get('daily-reports/{dailyReport}', [DailyReportController::class, 'show']);

        Route::get('expense-claims/categories', [ExpenseClaimController::class, 'categories']);
        Route::get('expense-claims/pending-approvals', [ExpenseClaimController::class, 'pendingApprovals']);
        Route::get('expense-claims/pending-verification', [ExpenseClaimController::class, 'pendingVerification'])
            ->middleware('permission:expense.verify');
        Route::get('expense-claims/pending-payout', [ExpenseClaimController::class, 'pendingPayout'])
            ->middleware('permission:expense.pay');
        Route::get('expense-claims/summary', [ExpenseClaimController::class, 'summary']);
        Route::post('expense-claims/pay-many', [ExpenseClaimController::class, 'payMany'])
            ->middleware('permission:expense.pay')
            ->name('expense-claims.pay-many');
        Route::get('expense-claims', [ExpenseClaimController::class, 'index']);
        Route::post('expense-claims', [ExpenseClaimController::class, 'store']);
        Route::get('expense-claims/{claim}', [ExpenseClaimController::class, 'show']);
        Route::put('expense-claims/{claim}', [ExpenseClaimController::class, 'update']);
        Route::put('expense-claims/{claim}/approve', [ExpenseClaimController::class, 'approve'])
            ->name('expense-claims.approve');
        Route::put('expense-claims/{claim}/verify', [ExpenseClaimController::class, 'verify'])
            ->middleware('permission:expense.verify')
            ->name('expense-claims.verify');
        Route::put('expense-claims/{claim}/pay', [ExpenseClaimController::class, 'pay'])
            ->middleware('permission:expense.pay')
            ->name('expense-claims.pay');
        Route::put('expense-claims/{claim}/reject', [ExpenseClaimController::class, 'reject'])
            ->name('expense-claims.reject');
        Route::delete('expense-claims/{claim}', [ExpenseClaimController::class, 'destroy']);

        Route::get('expense-bills/{bill}/download', [ExpenseBillController::class, 'download'])
            ->name('expense-bills.download');

        Route::prefix('expense-claims/{claim}')->scopeBindings()->group(function (): void {
            Route::get('bills', [ExpenseBillController::class, 'index']);
            Route::post('bills', [ExpenseBillController::class, 'store']);
            Route::delete('bills/{bill}', [ExpenseBillController::class, 'destroy']);
        });

        Route::get('exits/types', [EmployeeExitController::class, 'types']);
        Route::get('exits/pending-approvals', [EmployeeExitController::class, 'pendingApprovals']);
        Route::get('exits/pending-hr-approval', [EmployeeExitController::class, 'pendingHrApproval'])
            ->middleware('permission:exit.approve');
        Route::get('exits/serving-notice', [EmployeeExitController::class, 'servingNotice']);
        Route::get('exits/summary', [EmployeeExitController::class, 'summary'])
            ->middleware('permission:exit.approve');
        Route::get('exits', [EmployeeExitController::class, 'index']);
        Route::post('exits', [EmployeeExitController::class, 'store']);
        Route::get('exits/{exit}', [EmployeeExitController::class, 'show']);
        Route::put('exits/{exit}/manager-approve', [EmployeeExitController::class, 'managerApprove'])
            ->name('exits.manager-approve');
        Route::put('exits/{exit}/hr-approve', [EmployeeExitController::class, 'hrApprove'])
            ->middleware('permission:exit.approve')
            ->name('exits.hr-approve');
        Route::put('exits/{exit}/last-working-date', [EmployeeExitController::class, 'changeLastWorkingDate'])
            ->middleware('permission:exit.approve')
            ->name('exits.last-working-date');
        Route::put('exits/{exit}/complete', [EmployeeExitController::class, 'complete'])
            ->middleware('permission:exit.approve')
            ->name('exits.complete');
        Route::put('exits/{exit}/reject', [EmployeeExitController::class, 'reject'])
            ->name('exits.reject');
        Route::delete('exits/{exit}', [EmployeeExitController::class, 'destroy']);

        Route::get('exit-documents/{document}/download', [ExitDocumentController::class, 'download'])
            ->name('exit-documents.download');

        Route::get('policies/categories', [PolicyController::class, 'categories']);
        Route::get('my-policies', [PolicyController::class, 'myPolicies']);
        Route::get('policies', [PolicyController::class, 'index']);
        Route::post('policies', [PolicyController::class, 'store'])
            ->middleware('permission:policy.manage');
        Route::get('policies/{policy}', [PolicyController::class, 'show'])->name('policies.show');
        Route::post('policies/{policy}', [PolicyController::class, 'update'])
            ->middleware('permission:policy.manage');
        Route::get('policies/{policy}/download', [PolicyController::class, 'download'])
            ->name('policies.download');
        Route::put('policies/{policy}/acknowledge', [PolicyController::class, 'acknowledge'])
            ->name('policies.acknowledge');
        Route::post('policies/{policy}/publish', [PolicyController::class, 'publish'])
            ->middleware('permission:policy.manage')
            ->name('policies.publish');
        Route::put('policies/{policy}/archive', [PolicyController::class, 'archive'])
            ->middleware('permission:policy.manage')
            ->name('policies.archive');
        Route::get('policies/{policy}/compliance', [PolicyController::class, 'compliance'])
            ->middleware('permission:policy.manage');
        Route::delete('policies/{policy}', [PolicyController::class, 'destroy'])
            ->middleware('permission:policy.manage');

        Route::get('assets/categories', [AssetController::class, 'categories']);
        Route::get('assets/summary', [AssetController::class, 'summary'])
            ->middleware('permission:asset.manage');
        Route::get('my-assets', [AssetController::class, 'myAssets']);
        Route::get('assets', [AssetController::class, 'index']);
        Route::post('assets', [AssetController::class, 'store'])
            ->middleware('permission:asset.manage');
        Route::get('assets/{asset}', [AssetController::class, 'show']);
        Route::put('assets/{asset}', [AssetController::class, 'update'])
            ->middleware('permission:asset.manage');
        Route::get('assets/{asset}/history', [AssetController::class, 'history']);
        Route::post('assets/{asset}/allocate', [AssetController::class, 'allocate'])
            ->middleware('permission:asset.manage')
            ->name('assets.allocate');
        Route::put('assets/{asset}/return', [AssetController::class, 'returnAsset'])
            ->middleware('permission:asset.manage')
            ->name('assets.return');
        Route::put('assets/{asset}/retire', [AssetController::class, 'retire'])
            ->middleware('permission:asset.manage')
            ->name('assets.retire');
        Route::delete('assets/{asset}', [AssetController::class, 'destroy'])
            ->middleware('permission:asset.manage');

        Route::get('asset-requests/types', [AssetRequestController::class, 'types']);
        Route::get('asset-requests/pending', [AssetRequestController::class, 'pending']);
        Route::get('asset-requests', [AssetRequestController::class, 'index']);
        Route::post('asset-requests', [AssetRequestController::class, 'store']);
        Route::get('asset-requests/{assetRequest}', [AssetRequestController::class, 'show']);
        Route::put('asset-requests/{assetRequest}', [AssetRequestController::class, 'update']);
        Route::put('asset-requests/{assetRequest}/approve', [AssetRequestController::class, 'approve'])
            ->middleware('permission:asset.support')
            ->name('asset-requests.approve');
        Route::put('asset-requests/{assetRequest}/reject', [AssetRequestController::class, 'reject'])
            ->middleware('permission:asset.support')
            ->name('asset-requests.reject');
        Route::put('asset-requests/{assetRequest}/start', [AssetRequestController::class, 'start'])
            ->middleware('permission:asset.support')
            ->name('asset-requests.start');
        Route::put('asset-requests/{assetRequest}/resolve', [AssetRequestController::class, 'resolve'])
            ->middleware('permission:asset.support')
            ->name('asset-requests.resolve');
        Route::delete('asset-requests/{assetRequest}', [AssetRequestController::class, 'destroy']);

        Route::get('clearance-items/departments', [ClearanceController::class, 'departments']);
        Route::get('clearance-items', [ClearanceController::class, 'index']);
        Route::post('clearance-items', [ClearanceController::class, 'store'])
            ->middleware('permission:clearance.manage');
        Route::get('clearance-items/{item}', [ClearanceController::class, 'show']);
        Route::put('clearance-items/{item}', [ClearanceController::class, 'update'])
            ->middleware('permission:clearance.manage');
        Route::delete('clearance-items/{item}', [ClearanceController::class, 'destroy'])
            ->middleware('permission:clearance.manage');

        Route::get('clearance/pending', [ClearanceController::class, 'pending']);

        Route::prefix('exits/{exit}')->scopeBindings()->group(function (): void {
            Route::get('clearance', [ClearanceController::class, 'forExit']);
            Route::put('clearance/{clearance}', [ClearanceController::class, 'sign']);

            Route::get('documents', [ExitDocumentController::class, 'index']);
            Route::post('documents', [ExitDocumentController::class, 'store'])
                ->middleware('permission:exit.document');
            Route::delete('documents/{document}', [ExitDocumentController::class, 'destroy'])
                ->middleware('permission:exit.document');
        });

        Route::get('performance/score', [PerformanceController::class, 'score']);
        Route::get('performance/trend', [PerformanceController::class, 'trend']);
        Route::get('performance/leaderboard', [PerformanceController::class, 'leaderboard']);
        Route::get('performance/weights', [PerformanceController::class, 'weights']);
        Route::put('performance/weights', [PerformanceController::class, 'updateWeights'])
            ->middleware('permission:performance.manage');
        Route::post('performance/freeze', [PerformanceController::class, 'freeze'])
            ->middleware('permission:performance.manage');

        Route::get('goals/types', [PerformanceGoalController::class, 'types']);
        Route::get('goals/pending-approvals', [PerformanceGoalController::class, 'pendingApprovals']);
        Route::get('goals', [PerformanceGoalController::class, 'index']);
        Route::post('goals', [PerformanceGoalController::class, 'store']);
        Route::get('goals/{goal}', [PerformanceGoalController::class, 'show']);
        Route::put('goals/{goal}', [PerformanceGoalController::class, 'update']);
        Route::put('goals/{goal}/approve', [PerformanceGoalController::class, 'approve'])
            ->name('goals.approve');
        Route::put('goals/{goal}/progress', [PerformanceGoalController::class, 'progress'])
            ->name('goals.progress');
        Route::put('goals/{goal}/close', [PerformanceGoalController::class, 'close'])
            ->name('goals.close');
        Route::delete('goals/{goal}', [PerformanceGoalController::class, 'destroy']);

        Route::get('appraisal-cycles', [AppraisalController::class, 'cycles']);
        Route::post('appraisal-cycles', [AppraisalController::class, 'storeCycle'])
            ->middleware('permission:performance.manage');
        Route::get('appraisal-cycles/{cycle}', [AppraisalController::class, 'showCycle']);
        Route::put('appraisal-cycles/{cycle}', [AppraisalController::class, 'updateCycle'])
            ->middleware('permission:performance.manage');
        Route::post('appraisal-cycles/{cycle}/launch', [AppraisalController::class, 'launchCycle'])
            ->middleware('permission:performance.manage')
            ->name('cycles.launch');
        Route::put('appraisal-cycles/{cycle}/advance', [AppraisalController::class, 'advanceCycle'])
            ->middleware('permission:performance.manage')
            ->name('cycles.advance');
        Route::get('appraisal-cycles/{cycle}/summary', [AppraisalController::class, 'cycleSummary'])
            ->middleware('permission:performance.manage');

        Route::get('appraisals/pending-reviews', [AppraisalController::class, 'pendingReviews']);
        Route::get('appraisals', [AppraisalController::class, 'index']);
        Route::get('appraisals/{appraisal}', [AppraisalController::class, 'show']);
        Route::put('appraisals/{appraisal}/self-review', [AppraisalController::class, 'selfReview'])
            ->name('appraisals.self-review');
        Route::put('appraisals/{appraisal}/manager-review', [AppraisalController::class, 'managerReview'])
            ->name('appraisals.manager-review');
        Route::put('appraisals/{appraisal}/finalise', [AppraisalController::class, 'finalise'])
            ->middleware('permission:performance.finalise')
            ->name('appraisals.finalise');

        Route::get('realtime/config', [RealtimeController::class, 'config']);

        Route::get('notifications/unread-count', [NotificationController::class, 'summary']);
        Route::get('notifications/preferences', [NotificationController::class, 'preferences']);
        Route::put('notifications/preferences', [NotificationController::class, 'savePreferences']);
        Route::put('notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::post('notifications/announce', [NotificationController::class, 'announce'])
            ->middleware('permission:notification.send');
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::delete('notifications', [NotificationController::class, 'clear']);
        Route::get('notifications/{notification}', [NotificationController::class, 'show']);
        Route::put('notifications/{notification}/read', [NotificationController::class, 'markRead']);
        Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);

        Route::get('devices', [DeviceTokenController::class, 'index']);
        Route::post('devices', [DeviceTokenController::class, 'store']);
        Route::delete('devices/{deviceToken}', [DeviceTokenController::class, 'destroy']);

        Route::get('roles', [RoleController::class, 'index'])->middleware('permission:role.view');
        Route::post('roles', [RoleController::class, 'store'])->middleware('permission:role.create');
        Route::get('roles/{role}', [RoleController::class, 'show'])->middleware('permission:role.view');
        Route::put('roles/{role}', [RoleController::class, 'update'])->middleware('permission:role.edit');
        Route::delete('roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:role.delete');

        Route::get('users', [UserController::class, 'index'])->middleware('permission:user.view');
        Route::post('users', [UserController::class, 'store'])->middleware('permission:user.create');
        Route::get('users/{user}', [UserController::class, 'show'])->middleware('permission:user.view');
        Route::put('users/{user}', [UserController::class, 'update'])->middleware('permission:user.edit');
        Route::delete('users/{user}', [UserController::class, 'destroy'])->middleware('permission:user.delete');
    });
});

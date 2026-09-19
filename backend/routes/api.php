<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Company\AppraisalController;
use App\Http\Controllers\Company\AssetController;
use App\Http\Controllers\Company\AssetRequestController;
use App\Http\Controllers\Company\AttendanceController;
use App\Http\Controllers\Company\ApplicationController;
use App\Http\Controllers\Company\AuditLogController;
use App\Http\Controllers\Company\CareerPageController;
use App\Http\Controllers\Company\JobOpeningController;
use App\Http\Controllers\Company\JoiningController;
use App\Http\Controllers\Company\BranchController;
use App\Http\Controllers\Company\CompanyController;
use App\Http\Controllers\Company\ClearanceController;
use App\Http\Controllers\Company\CompanySettingController;
use App\Http\Controllers\Company\DailyReportController;
use App\Http\Controllers\Company\DashboardController;
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
use App\Http\Controllers\Company\FnfController;
use App\Http\Controllers\Company\HolidayController;
use App\Http\Controllers\Company\ImportController;
use App\Http\Controllers\Company\InterviewController;
use App\Http\Controllers\Company\InvoiceController;
use App\Http\Controllers\Company\OfferLetterController;
use App\Http\Controllers\Company\IncentiveController;
use App\Http\Controllers\Company\LeaveBalanceController;
use App\Http\Controllers\Company\LeaveController;
use App\Http\Controllers\Company\LeaveTypeController;
use App\Http\Controllers\Company\NotificationController;
use App\Http\Controllers\Company\OrgChartController;
use App\Http\Controllers\Company\PerformanceController;
use App\Http\Controllers\Company\PerformanceGoalController;
use App\Http\Controllers\Company\PolicyController;
use App\Http\Controllers\Company\RealtimeController;
use App\Http\Controllers\Company\RecognitionController;
use App\Http\Controllers\Company\RegularizationController;
use App\Http\Controllers\Company\ReportController;
use App\Http\Controllers\Company\RoleController;
use App\Http\Controllers\Company\StatutoryReturnController;
use App\Http\Controllers\Company\TaskAttachmentController;
use App\Http\Controllers\Company\TaskCommentController;
use App\Http\Controllers\Company\TicketCategoryController;
use App\Http\Controllers\Company\TicketController;
use App\Http\Controllers\Company\PayrollController;
use App\Http\Controllers\Company\SalaryAdvanceController;
use App\Http\Controllers\Company\SalaryComponentController;
use App\Http\Controllers\Company\SalaryStructureController;
use App\Http\Controllers\Company\SalaryTransferController;
use App\Http\Controllers\Company\TicketSlaController;
use App\Http\Controllers\Company\TaskController;
use App\Http\Controllers\Company\TeamController;
use App\Http\Controllers\Company\UserController;
use App\Http\Controllers\Company\UserPermissionController;
use App\Http\Controllers\Company\WorkRecordController;
use App\Http\Controllers\Company\WorkShiftController;
use App\Http\Controllers\Platform\PlanController;
use App\Http\Controllers\Public\CareerController;
use App\Http\Controllers\Permission\PermissionController;
use App\Http\Controllers\Profile\MyDetailsController;
use App\Http\Controllers\Profile\OnboardingController;
use App\Http\Controllers\Profile\ProfileController;
use Illuminate\Support\Facades\Route;

Route::prefix('hrms')->group(function (): void {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:sensitive');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:sensitive');

    Route::middleware('throttle:careers')->group(function (): void {
        Route::get('careers/{key}/openings', [CareerController::class, 'openings']);
        Route::get('careers/{key}/openings/{slug}', [CareerController::class, 'opening']);
    });

    Route::post('careers/{key}/openings/{slug}/apply', [CareerController::class, 'apply'])
        ->middleware('throttle:apply');

    Route::post('intake/{key}', [CareerController::class, 'intake'])->middleware('throttle:apply');

    Route::middleware(['auth:api', 'tenant', 'company.active', 'policy.gate', 'throttle:api'])->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/refresh', [AuthController::class, 'refresh']);
        Route::post('auth/logout-all', [AuthController::class, 'logoutAll']);
        Route::get('auth/sessions', [AuthController::class, 'sessions']);
        Route::post('auth/change-password', [AuthController::class, 'changePassword'])->middleware('throttle:sensitive');

        Route::get('profile', [ProfileController::class, 'show']);
        Route::get('profile/completion', [ProfileController::class, 'completion']);
        Route::put('profile', [ProfileController::class, 'update']);
        Route::post('profile/avatar', [ProfileController::class, 'uploadAvatar']);
        Route::delete('profile/avatar', [ProfileController::class, 'deleteAvatar']);
        Route::get('profile/documents', [ProfileController::class, 'documents']);
        Route::post('profile/documents', [ProfileController::class, 'uploadDocument']);
        Route::delete('profile/documents/{document}', [ProfileController::class, 'deleteDocument']);

        Route::get('profile/family', [MyDetailsController::class, 'family']);
        Route::post('profile/family', [MyDetailsController::class, 'addFamily']);
        Route::put('profile/family/{familyMember}', [MyDetailsController::class, 'updateFamily']);
        Route::delete('profile/family/{familyMember}', [MyDetailsController::class, 'deleteFamily']);

        Route::get('profile/bank-accounts', [MyDetailsController::class, 'bankAccounts']);
        Route::post('profile/bank-accounts', [MyDetailsController::class, 'addBankAccount']);
        Route::put('profile/bank-accounts/{bankAccount}', [MyDetailsController::class, 'updateBankAccount']);
        Route::delete('profile/bank-accounts/{bankAccount}', [MyDetailsController::class, 'deleteBankAccount']);

        Route::get('onboarding', [OnboardingController::class, 'show']);
        Route::post('onboarding/profile-seen', [OnboardingController::class, 'profileSeen']);
        Route::post('onboarding/tour-done', [OnboardingController::class, 'tourDone']);
        Route::post('onboarding/tour-reset', [OnboardingController::class, 'tourReset']);

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

            Route::get('plans', [PlanController::class, 'index']);
            Route::post('plans', [PlanController::class, 'store']);
            Route::get('plans/{plan}', [PlanController::class, 'show']);
            Route::put('plans/{plan}', [PlanController::class, 'update']);
            Route::delete('plans/{plan}', [PlanController::class, 'destroy']);
            Route::put('companies/{company}/plan', [PlanController::class, 'assign']);

            Route::put('invoices/{invoice}/mark-paid', [InvoiceController::class, 'markPaid']);
            Route::put('invoices/{invoice}/cancel', [InvoiceController::class, 'cancel']);
        });

        Route::middleware('permission:invoice.view')->group(function (): void {
            Route::get('invoices', [InvoiceController::class, 'index']);
            Route::get('invoices/summary', [InvoiceController::class, 'summary']);
            Route::get('invoices/{invoice}', [InvoiceController::class, 'show']);
            Route::get('invoices/{invoice}/download', [InvoiceController::class, 'download'])
                ->name('invoices.download');
        });

        Route::get('dashboard', [DashboardController::class, 'index']);

        Route::get('statutory-returns', [StatutoryReturnController::class, 'index'])
            ->middleware('permission:report.view');
        Route::get('statutory-returns/{return}', [StatutoryReturnController::class, 'show'])
            ->middleware('permission:report.view');
        Route::get('statutory-returns/{return}/download', [StatutoryReturnController::class, 'download'])
            ->middleware('permission:report.export')
            ->name('statutory-returns.download');

        Route::get('reports', [ReportController::class, 'index'])
            ->middleware('permission:report.view');
        Route::get('reports/{report}', [ReportController::class, 'show'])
            ->middleware('permission:report.view');
        Route::get('reports/{report}/download', [ReportController::class, 'download'])
            ->middleware('permission:report.export')
            ->name('reports.download');

        Route::get('imports/modules', [ImportController::class, 'modules']);
        Route::get('imports/{module}/sample', [ImportController::class, 'sample']);
        Route::post('imports/{module}', [ImportController::class, 'store']);

        Route::get('company-settings', [CompanySettingController::class, 'show'])->middleware('permission:company.view');
        Route::put('company-settings', [CompanySettingController::class, 'update'])->middleware('permission:company.edit');
        Route::get('payroll-settings', [CompanySettingController::class, 'payroll'])
            ->middleware('permission:payroll.view');
        Route::put('payroll-settings', [CompanySettingController::class, 'updatePayroll'])
            ->middleware('permission:payroll.approve');

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

        Route::get('org-chart', [OrgChartController::class, 'index']);

        Route::middleware('permission:recruitment.view')->group(function (): void {
            Route::get('openings', [JobOpeningController::class, 'index']);
            Route::get('openings/summary', [JobOpeningController::class, 'summary']);
            Route::get('openings/{opening}', [JobOpeningController::class, 'show']);
            Route::get('openings/{opening}/pipeline', [JobOpeningController::class, 'pipeline']);
            Route::get('openings/{opening}/applications', [ApplicationController::class, 'openingApplications']);

            Route::get('applications', [ApplicationController::class, 'index']);
            Route::get('applications/{application}', [ApplicationController::class, 'show']);
            Route::get('applications/{application}/interviews', [InterviewController::class, 'forApplication']);
            Route::get('interviews', [InterviewController::class, 'index']);
            Route::get('candidates', [ApplicationController::class, 'candidates']);
            Route::get('offer-letters', [OfferLetterController::class, 'index']);
            Route::get('offer-letters/summary', [OfferLetterController::class, 'summary']);
            Route::get('offer-letters/{letter}/preview', [OfferLetterController::class, 'preview']);
            Route::get('offer-letters/{letter}/download', [OfferLetterController::class, 'download'])
                ->name('offers.download');
            Route::get('applications/{application}/offer-letter', [OfferLetterController::class, 'forApplication']);
            Route::get('joinings', [JoiningController::class, 'index']);
            Route::get('candidates/{candidate}/resume', [ApplicationController::class, 'resume'])
                ->name('candidates.resume');
        });

        Route::middleware('permission:recruitment.request')->group(function (): void {
            Route::post('openings/request', [JobOpeningController::class, 'request']);
        });

        Route::middleware('permission:recruitment.offer')->group(function (): void {
            Route::post('applications/{application}/offer-letter', [OfferLetterController::class, 'store']);
            Route::put('offer-letters/{letter}/answer', [OfferLetterController::class, 'answer']);
            Route::put('offer-letters/{letter}/withdraw', [OfferLetterController::class, 'withdraw']);
        });

        Route::post('applications/{application}/convert', [JoiningController::class, 'convert'])
            ->middleware('permission:employee.create');

        Route::middleware('permission:recruitment.manage')->group(function (): void {
            Route::post('openings', [JobOpeningController::class, 'store']);
            Route::put('openings/{opening}/decide', [JobOpeningController::class, 'decide']);
            Route::put('openings/{opening}', [JobOpeningController::class, 'update']);
            Route::delete('openings/{opening}', [JobOpeningController::class, 'destroy']);

            Route::put('applications/bulk-move', [ApplicationController::class, 'bulkMove']);
            Route::put('applications/{application}/move', [ApplicationController::class, 'move']);

            Route::post('applications/{application}/interviews', [InterviewController::class, 'store']);
            Route::put('interviews/{interview}', [InterviewController::class, 'update']);
            Route::put('interviews/{interview}/cancel', [InterviewController::class, 'cancel']);
        });

        Route::middleware('permission:interview.conduct')->group(function (): void {
            Route::get('interviews/mine', [InterviewController::class, 'mine']);
            Route::put('interviews/{interview}/feedback', [InterviewController::class, 'feedback']);
        });

        Route::middleware('permission:recruitment.career_page')->group(function (): void {
            Route::get('career-page', [CareerPageController::class, 'show']);
            Route::put('career-page', [CareerPageController::class, 'update']);
            Route::post('career-page/regenerate', [CareerPageController::class, 'regenerate']);
        });

        Route::middleware('permission:audit.view')->group(function (): void {
            Route::get('audit-logs', [AuditLogController::class, 'index']);
            Route::get('audit-logs/filters', [AuditLogController::class, 'filters']);
            Route::get('audit-logs/{log}', [AuditLogController::class, 'show'])->whereNumber('log');
        });

        Route::get('ticket-slas', [TicketSlaController::class, 'index']);
        Route::put('ticket-slas', [TicketSlaController::class, 'update'])
            ->middleware('permission:ticket.category_manage');

        Route::get('ticket-categories', [TicketCategoryController::class, 'index']);
        Route::post('ticket-categories', [TicketCategoryController::class, 'store'])
            ->middleware('permission:ticket.category_manage');
        Route::get('ticket-categories/{category}', [TicketCategoryController::class, 'show']);
        Route::put('ticket-categories/{category}', [TicketCategoryController::class, 'update'])
            ->middleware('permission:ticket.category_manage');
        Route::delete('ticket-categories/{category}', [TicketCategoryController::class, 'destroy'])
            ->middleware('permission:ticket.category_manage');

        Route::get('tickets', [TicketController::class, 'index']);
        Route::get('tickets/summary', [TicketController::class, 'summary']);
        Route::post('tickets', [TicketController::class, 'store']);
        Route::get('tickets/{ticket}', [TicketController::class, 'show']);
        Route::post('tickets/{ticket}/claim', [TicketController::class, 'claim'])->name('tickets.claim');
        Route::post('tickets/{ticket}/assign', [TicketController::class, 'assign'])->name('tickets.assign');
        Route::post('tickets/{ticket}/comments', [TicketController::class, 'comment'])->name('tickets.comment');
        Route::post('tickets/{ticket}/ask-info', [TicketController::class, 'askInfo'])->name('tickets.ask-info');
        Route::post('tickets/{ticket}/resolve', [TicketController::class, 'resolve'])->name('tickets.resolve');
        Route::post('tickets/{ticket}/reopen', [TicketController::class, 'reopen'])->name('tickets.reopen');
        Route::post('tickets/{ticket}/close', [TicketController::class, 'close'])->name('tickets.close');
        Route::post('tickets/{ticket}/cancel', [TicketController::class, 'cancel'])->name('tickets.cancel');

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
        Route::get('employees/reporting-managers', [EmployeeController::class, 'reportingManagers'])
            ->middleware('permission:employee.view');
        Route::post('employees', [EmployeeController::class, 'store'])->middleware('permission:employee.create');
        Route::get('employees/{employee}', [EmployeeController::class, 'show'])->middleware('permission:employee.view');
        Route::put('employees/{employee}', [EmployeeController::class, 'update'])->middleware('permission:employee.edit');
        Route::delete('employees/{employee}', [EmployeeController::class, 'destroy'])->middleware('permission:employee.delete');
        Route::post('employees/{employee}/complete-onboarding', [EmployeeController::class, 'completeOnboarding'])
            ->middleware('permission:employee.edit');

        Route::get('salary-components', [SalaryComponentController::class, 'index'])
            ->middleware('permission:salary_structure.view');
        Route::post('salary-components', [SalaryComponentController::class, 'store'])
            ->middleware('permission:salary_component.manage');
        Route::post('salary-components/standard', [SalaryComponentController::class, 'standard'])
            ->middleware('permission:salary_component.manage');
        Route::put('salary-components/{salaryComponent}', [SalaryComponentController::class, 'update'])
            ->middleware('permission:salary_component.manage');
        Route::delete('salary-components/{salaryComponent}', [SalaryComponentController::class, 'destroy'])
            ->middleware('permission:salary_component.manage');

        Route::get('my-payslips', [PayrollController::class, 'mine']);
        Route::get('my-settlement', [FnfController::class, 'mine']);
        Route::get('my-advances', [SalaryAdvanceController::class, 'mine']);
        Route::post('my-advances', [SalaryAdvanceController::class, 'store']);
        Route::get('payslips/{payrollItem}/preview', [PayrollController::class, 'previewSlip'])
            ->name('payslips.preview');
        Route::get('payslips/{payrollItem}/download', [PayrollController::class, 'downloadSlip'])
            ->name('payslips.download');

        Route::get('payroll-runs', [PayrollController::class, 'index'])->middleware('permission:payroll.view');
        Route::post('payroll-runs', [PayrollController::class, 'store'])->middleware('permission:payroll.run');
        Route::get('employees/{employee}/payroll', [PayrollController::class, 'employeeMonths'])
            ->middleware('permission:payroll.view');
        Route::get('form16/bulk', [PayrollController::class, 'form16Bulk'])
            ->middleware('permission:payroll.view')
            ->name('form16.bulk');
        Route::get('employees/{employee}/form16', [PayrollController::class, 'form16'])
            ->middleware('permission:payroll.view')
            ->name('form16.preview');
        Route::get('employees/{employee}/form16/download', [PayrollController::class, 'form16Download'])
            ->middleware('permission:payroll.view')
            ->name('form16.download');
        Route::get('payroll-runs/{payrollRun}', [PayrollController::class, 'show'])
            ->middleware('permission:payroll.view');
        Route::get('payroll-runs/{payrollRun}/payslips', [PayrollController::class, 'items'])
            ->middleware('permission:payroll.view');
        Route::post('payroll-runs/{payrollRun}/calculate', [PayrollController::class, 'calculate'])
            ->middleware('permission:payroll.run');
        Route::get('payroll-runs/{payrollRun}/approval-review', [PayrollController::class, 'approvalReview'])
            ->middleware('permission:payroll.approve');
        Route::post('payroll-runs/{payrollRun}/approve-items', [PayrollController::class, 'approveItems'])
            ->middleware('permission:payroll.approve');
        Route::post('payroll-runs/{payrollRun}/approve', [PayrollController::class, 'approve'])
            ->middleware('permission:payroll.approve');
        Route::post('payroll-runs/{payrollRun}/cancel', [PayrollController::class, 'cancel'])
            ->middleware('permission:payroll.approve');

        Route::get('company-bank-accounts', [SalaryTransferController::class, 'accounts'])
            ->middleware('permission:company_bank.view');
        Route::post('company-bank-accounts', [SalaryTransferController::class, 'storeAccount'])
            ->middleware('permission:company_bank.manage');
        Route::put('company-bank-accounts/{companyBankAccount}', [SalaryTransferController::class, 'updateAccount'])
            ->middleware('permission:company_bank.manage');
        Route::delete('company-bank-accounts/{companyBankAccount}', [SalaryTransferController::class, 'destroyAccount'])
            ->middleware('permission:company_bank.manage');
        Route::post('company-bank-accounts/{companyBankAccount}/top-up', [SalaryTransferController::class, 'topUp'])
            ->middleware('permission:company_bank.manage');
        Route::get('company-bank-accounts/{companyBankAccount}/statement', [SalaryTransferController::class, 'statement'])
            ->middleware('permission:company_bank.view');

        Route::get('payroll-runs/{payrollRun}/transfers', [SalaryTransferController::class, 'disbursements'])
            ->middleware('permission:payroll.view');
        Route::get('payroll-runs/{payrollRun}/transfer-quote', [SalaryTransferController::class, 'runQuote'])
            ->middleware('permission:salary.disburse');
        Route::post('payroll-runs/{payrollRun}/transfer', [SalaryTransferController::class, 'transferRun'])
            ->middleware(['permission:salary.disburse', 'throttle:transfer']);
        Route::get('payroll-runs/{payrollRun}/schedule', [SalaryTransferController::class, 'scheduleDefaults'])
            ->middleware('permission:salary.disburse');
        Route::post('payroll-runs/{payrollRun}/schedule', [SalaryTransferController::class, 'schedule'])
            ->middleware(['permission:salary.disburse', 'throttle:transfer']);
        Route::delete('payroll-runs/{payrollRun}/schedule', [SalaryTransferController::class, 'cancelSchedule'])
            ->middleware('permission:salary.disburse');

        Route::get('payslips/{payrollItem}/transfer-quote', [SalaryTransferController::class, 'quote'])
            ->middleware('permission:salary.disburse');
        Route::post('payslips/{payrollItem}/transfer', [SalaryTransferController::class, 'transferOne'])
            ->middleware(['permission:salary.disburse', 'throttle:transfer']);
        Route::post('payslips/{payrollItem}/approve', [PayrollController::class, 'approveItem'])
            ->middleware('permission:payroll.approve');
        Route::post('payslips/{payrollItem}/unapprove', [PayrollController::class, 'unapproveItem'])
            ->middleware('permission:payroll.approve');

        Route::get('payslips/{payrollItem}', [PayrollController::class, 'showItem'])
            ->middleware('permission:payroll.view');
        Route::put('payslips/{payrollItem}/lop', [PayrollController::class, 'setLop'])
            ->middleware('permission:payroll.run');
        Route::post('payslips/{payrollItem}/hold', [PayrollController::class, 'hold'])
            ->middleware('permission:payroll.run');
        Route::post('payslips/{payrollItem}/release', [PayrollController::class, 'release'])
            ->middleware('permission:payroll.run');

        Route::get('advances/summary', [SalaryAdvanceController::class, 'summary'])
            ->middleware('permission:advance.view');
        Route::get('advances', [SalaryAdvanceController::class, 'index'])
            ->middleware('permission:advance.view');
        Route::get('advances/{salaryAdvance}', [SalaryAdvanceController::class, 'show'])
            ->middleware('permission:advance.view');
        Route::post('advances/{salaryAdvance}/decide', [SalaryAdvanceController::class, 'decide'])
            ->middleware('permission:advance.approve');
        Route::put('advances/{salaryAdvance}/plan', [SalaryAdvanceController::class, 'updatePlan'])
            ->middleware('permission:advance.manage');
        Route::post('advances/{salaryAdvance}/hold', [SalaryAdvanceController::class, 'hold'])
            ->middleware('permission:advance.manage');
        Route::post('advances/{salaryAdvance}/release', [SalaryAdvanceController::class, 'release'])
            ->middleware('permission:advance.manage');
        Route::post('advances/{salaryAdvance}/cancel', [SalaryAdvanceController::class, 'cancel'])
            ->middleware('permission:advance.manage');
        Route::get('advances/{salaryAdvance}/transfer-quote', [SalaryAdvanceController::class, 'quote'])
            ->middleware('permission:advance.manage');
        Route::post('advances/{salaryAdvance}/transfer', [SalaryAdvanceController::class, 'transfer'])
            ->middleware(['permission:advance.manage', 'permission:salary.disburse', 'throttle:transfer']);

        Route::get('fnf-settlements/pending-exits', [FnfController::class, 'pending'])
            ->middleware('permission:fnf.view');
        Route::get('fnf-settlements', [FnfController::class, 'index'])
            ->middleware('permission:fnf.view');
        Route::post('fnf-settlements', [FnfController::class, 'store'])
            ->middleware('permission:fnf.manage');
        Route::get('fnf-settlements/{fnfSettlement}', [FnfController::class, 'show'])
            ->middleware('permission:fnf.view');
        Route::post('fnf-settlements/{fnfSettlement}/calculate', [FnfController::class, 'calculate'])
            ->middleware('permission:fnf.manage');
        Route::post('fnf-settlements/{fnfSettlement}/lines', [FnfController::class, 'addLine'])
            ->middleware('permission:fnf.manage');
        Route::post('fnf-settlements/bulk-approve', [FnfController::class, 'bulkApprove'])
            ->middleware('permission:fnf.approve');
        Route::post('fnf-settlements/{fnfSettlement}/approve', [FnfController::class, 'approve'])
            ->middleware('permission:fnf.approve');
        Route::post('fnf-settlements/{fnfSettlement}/hold', [FnfController::class, 'hold'])
            ->middleware('permission:fnf.manage');
        Route::post('fnf-settlements/{fnfSettlement}/release', [FnfController::class, 'release'])
            ->middleware('permission:fnf.manage');
        Route::post('fnf-settlements/{fnfSettlement}/cancel', [FnfController::class, 'cancel'])
            ->middleware('permission:fnf.approve');
        Route::post('fnf-settlements/{fnfSettlement}/mark-recovered', [FnfController::class, 'markRecovered'])
            ->middleware('permission:fnf.approve');
        Route::get('fnf-settlements/{fnfSettlement}/preview', [FnfController::class, 'preview'])
            ->middleware('permission:fnf.view');
        Route::get('fnf-settlements/{fnfSettlement}/download', [FnfController::class, 'download'])
            ->middleware('permission:fnf.view');
        Route::get('fnf-settlements/{fnfSettlement}/transfer-quote', [FnfController::class, 'quote'])
            ->middleware('permission:salary.disburse');
        Route::post('fnf-settlements/{fnfSettlement}/transfer', [FnfController::class, 'transfer'])
            ->middleware(['permission:salary.disburse', 'throttle:transfer']);

        Route::put('fnf-lines/{fnfLine}/apply', [FnfController::class, 'applyLine'])
            ->middleware('permission:fnf.manage');
        Route::delete('fnf-lines/{fnfLine}', [FnfController::class, 'removeLine'])
            ->middleware('permission:fnf.manage');

        Route::get('salary-structures/coverage', [SalaryStructureController::class, 'coverage'])
            ->middleware('permission:salary_structure.view');
        Route::post('salary-structures/preview', [SalaryStructureController::class, 'preview'])
            ->middleware('permission:salary_structure.manage');

        Route::prefix('employees/{employee}')->scopeBindings()->group(function (): void {
            Route::get('salary-structures', [SalaryStructureController::class, 'index'])
                ->middleware('permission:salary_structure.view');
            Route::get('salary-structures/current', [SalaryStructureController::class, 'current'])
                ->middleware('permission:salary_structure.view');
            Route::post('salary-structures', [SalaryStructureController::class, 'store'])
                ->middleware('permission:salary_structure.manage');

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
        Route::post('attendance/bulk', [AttendanceController::class, 'markBulk'])
            ->middleware('permission:attendance.regularize');
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

        Route::get('exit-documents/{document}/preview', [ExitDocumentController::class, 'preview'])
            ->name('exit-documents.preview');
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
            Route::post('documents/generate', [ExitDocumentController::class, 'generate'])
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
        Route::get('goals/pending-verification', [PerformanceGoalController::class, 'pendingVerification']);
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
        Route::put('goals/{goal}/submit', [PerformanceGoalController::class, 'submit'])
            ->name('goals.submit');
        Route::put('goals/{goal}/verify', [PerformanceGoalController::class, 'verify'])
            ->name('goals.verify');
        Route::put('goals/{goal}/finalise', [PerformanceGoalController::class, 'finalise'])
            ->middleware('permission:okr.verify')
            ->name('goals.finalise');
        Route::delete('goals/{goal}', [PerformanceGoalController::class, 'destroy']);

        Route::get('incentive-rules', [IncentiveController::class, 'rules']);
        Route::post('incentive-rules', [IncentiveController::class, 'storeRule'])
            ->middleware('permission:incentive.manage');
        Route::get('incentive-rules/{rule}', [IncentiveController::class, 'showRule']);
        Route::put('incentive-rules/{rule}', [IncentiveController::class, 'updateRule'])
            ->middleware('permission:incentive.manage');
        Route::delete('incentive-rules/{rule}', [IncentiveController::class, 'destroyRule'])
            ->middleware('permission:incentive.manage');

        Route::get('incentives/summary', [IncentiveController::class, 'summary']);
        Route::post('incentives/calculate', [IncentiveController::class, 'calculate'])
            ->middleware('permission:incentive.approve');
        Route::get('incentives', [IncentiveController::class, 'index']);
        Route::get('incentives/{incentive}', [IncentiveController::class, 'show']);
        Route::put('incentives/{incentive}/approve', [IncentiveController::class, 'approve'])
            ->middleware('permission:incentive.approve')
            ->name('incentives.approve');
        Route::put('incentives/{incentive}/reject', [IncentiveController::class, 'reject'])
            ->middleware('permission:incentive.approve')
            ->name('incentives.reject');

        Route::get('recognitions/types', [RecognitionController::class, 'types']);
        Route::get('recognitions/summary', [RecognitionController::class, 'summary']);
        Route::get('recognitions', [RecognitionController::class, 'index']);
        Route::post('recognitions', [RecognitionController::class, 'store'])
            ->middleware('permission:recognition.give');
        Route::get('recognitions/{recognition}', [RecognitionController::class, 'show']);
        Route::delete('recognitions/{recognition}', [RecognitionController::class, 'destroy']);

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

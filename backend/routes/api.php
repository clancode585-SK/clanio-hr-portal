<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Company\AttendanceController;
use App\Http\Controllers\Company\BranchController;
use App\Http\Controllers\Company\CompanyController;
use App\Http\Controllers\Company\DepartmentController;
use App\Http\Controllers\Company\DesignationController;
use App\Http\Controllers\Company\EmployeeBankAccountController;
use App\Http\Controllers\Company\EmployeeController;
use App\Http\Controllers\Company\EmployeeDocumentController;
use App\Http\Controllers\Company\EmployeeFamilyController;
use App\Http\Controllers\Company\HolidayController;
use App\Http\Controllers\Company\RoleController;
use App\Http\Controllers\Company\TeamController;
use App\Http\Controllers\Company\UserController;
use App\Http\Controllers\Company\WorkShiftController;
use App\Http\Controllers\Permission\PermissionController;
use App\Http\Controllers\Profile\ProfileController;
use Illuminate\Support\Facades\Route;

Route::prefix('hrms')->group(function (): void {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:sensitive');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:sensitive');

    Route::middleware(['auth:api', 'tenant', 'company.active', 'throttle:api'])->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/change-password', [AuthController::class, 'changePassword'])->middleware('throttle:sensitive');

        Route::get('profile', [ProfileController::class, 'show']);
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
        });

        Route::get('permissions', [PermissionController::class, 'index'])->middleware('permission:permission.view');

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

        Route::post('attendance/check-in', [AttendanceController::class, 'checkIn']);
        Route::post('attendance/check-out', [AttendanceController::class, 'checkOut']);
        Route::get('attendance/today', [AttendanceController::class, 'today']);
        Route::get('attendance/calendar', [AttendanceController::class, 'calendar']);
        Route::get('attendance', [AttendanceController::class, 'index']);
        Route::get('attendance/{attendance}', [AttendanceController::class, 'show']);

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

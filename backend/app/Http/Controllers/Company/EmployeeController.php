<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\EmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\Employee;
use App\Services\EmployeeService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends ApiController
{
    public function __construct(private readonly EmployeeService $employees) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Employee::query()
            ->withoutGlobalScope(\App\Support\Scopes\CompanyScope::class)
            ->with([
                'user' => fn ($q) => $q->withoutGlobalScope(\App\Support\Scopes\CompanyScope::class)->with(['department' => fn ($dq) => $dq->withoutGlobalScope(\App\Support\Scopes\CompanyScope::class)]),
                'designation' => fn ($q) => $q->withoutGlobalScope(\App\Support\Scopes\CompanyScope::class),
            ])
            ->withCount(['familyMembers', 'bankAccounts']);

        if ($user) {
            $query->visibleTo($user);
        }

        $employees = $this->applyFilters(
            $query,
            $request,
            ['employee_code', 'personal_email', 'pan_number'],
            [
                'onboarding_status' => 'onboarding_status',
                'employment_type' => 'employment_type',
                'designation_id' => 'designation_id',
                'reporting_manager_id' => 'reporting_manager_id',
            ]
        )->latest('id')->paginate($this->perPage($request));

        return ApiResponse::paginated($employees, EmployeeResource::class, 'Employees fetched successfully');
    }

    public function store(EmployeeRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new EmployeeResource($this->employees->create($request->validated(), $request->user(), $this->tenantId())),
            'Employee onboarded successfully'
        );
    }

    public function show(Employee $employee): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeResource(
                $employee->load(['user.roles', 'designation', 'reportingManager'])
                    ->loadCount(['familyMembers', 'bankAccounts'])
            ),
            'Employee details fetched successfully'
        );
    }

    public function update(EmployeeRequest $request, Employee $employee): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeResource($this->employees->update($employee, $request->validated(), $request->user())),
            'Employee updated successfully'
        );
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $this->employees->delete($employee);

        return ApiResponse::success(null, 'Employee record deleted successfully');
    }

    public function completeOnboarding(Request $request, Employee $employee): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeResource($this->employees->completeOnboarding($employee, $request->user())),
            'Onboarding completed successfully'
        );
    }
}

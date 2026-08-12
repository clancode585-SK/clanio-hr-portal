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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends ApiController
{
    public function __construct(private readonly EmployeeService $employees) {}

    public function index(Request $request): JsonResponse
    {
        $employees = TenantCache::remember(
            TenantCache::EMPLOYEES,
            'actor:' . $request->user()->id . ':' . $this->cacheKey($request),
            fn () => $this->applyFilters(
                Employee::query()
                    ->unless(
                        $request->filled('employment_status'),
                        fn (Builder $query): Builder => $query->where('employment_status', '!=', Employee::EMPLOYMENT_EXITED)
                    )
                    ->with(['user', 'designation'])
                    ->withCount(['familyMembers', 'bankAccounts', 'documents'])
                    ->visibleTo($request->user()),
                $request,
                ['employee_code', 'personal_email', 'pan_number'],
                [
                    'onboarding_status' => 'onboarding_status',
                    'employment_status' => 'employment_status',
                    'employment_type' => 'employment_type',
                    'designation_id' => 'designation_id',
                    'reporting_manager_id' => 'reporting_manager_id',
                ]
            )->latest('id')->paginate($this->perPage($request))
        );

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
                    ->loadCount(['familyMembers', 'bankAccounts', 'documents'])
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

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Resources\EmployeeResource;
use App\Models\Application;
use App\Services\JoiningService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class JoiningController extends ApiController
{
    public function __construct(private readonly JoiningService $joining) {}

    public function index(): JsonResponse
    {
        $companyId = $this->tenantId();

        if ($companyId === null) {
            throw new ApiException(
                'Joinings belong to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return ApiResponse::success($this->joining->pipeline($companyId), 'Joining pipeline fetched successfully');
    }

    public function convert(Request $request, Application $application): JsonResponse
    {
        $companyId = $this->tenantId();

        $data = $request->validate([
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('company_id', $companyId)],
            'work_email' => ['nullable', 'email:rfc', 'max:200'],
            'password' => ['nullable', 'string', 'min:8', 'max:64'],
            'designation_id' => ['nullable', 'integer', Rule::exists('designations', 'id')->where('company_id', $companyId)],
            'department_id' => ['nullable', 'integer', Rule::exists('departments', 'id')->where('company_id', $companyId)],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'team_id' => ['nullable', 'integer', Rule::exists('teams', 'id')->where('company_id', $companyId)],
            'work_shift_id' => ['nullable', 'integer', Rule::exists('work_shifts', 'id')->where('company_id', $companyId)],
            'reporting_manager_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('company_id', $companyId)],
        ], [
            'role_id.required' => 'Pick the role this person gets in the workspace.',
        ]);

        $employee = $this->joining->convert($application, $data, $request->user());

        return ApiResponse::created(
            new EmployeeResource($employee->load(['user', 'designation'])),
            $employee->user?->name . ' is on the roll as ' . $employee->employee_code . '. Onboarding has started.'
        );
    }
}

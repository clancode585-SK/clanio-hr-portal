<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\EmployeeFamilyRequest;
use App\Http\Resources\EmployeeFamilyMemberResource;
use App\Models\Employee;
use App\Models\EmployeeFamilyMember;
use App\Services\EmployeeFamilyService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeFamilyController extends ApiController
{
    public function __construct(private readonly EmployeeFamilyService $family) {}

    public function index(Employee $employee): JsonResponse
    {
        return ApiResponse::success(
            EmployeeFamilyMemberResource::collection($employee->familyMembers()->orderBy('id')->get()),
            'Family members fetched successfully'
        );
    }

    public function store(EmployeeFamilyRequest $request, Employee $employee): JsonResponse
    {
        return ApiResponse::created(
            new EmployeeFamilyMemberResource($this->family->create($employee, $request->validated(), $request->user())),
            'Family member added successfully'
        );
    }

    public function show(Employee $employee, EmployeeFamilyMember $familyMember): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeFamilyMemberResource($familyMember),
            'Family member details fetched successfully'
        );
    }

    public function update(EmployeeFamilyRequest $request, Employee $employee, EmployeeFamilyMember $familyMember): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeFamilyMemberResource($this->family->update($familyMember, $request->validated(), $request->user())),
            'Family member updated successfully'
        );
    }

    public function destroy(Request $request, Employee $employee, EmployeeFamilyMember $familyMember): JsonResponse
    {
        $this->family->delete($familyMember);

        return ApiResponse::success(null, 'Family member removed successfully');
    }
}

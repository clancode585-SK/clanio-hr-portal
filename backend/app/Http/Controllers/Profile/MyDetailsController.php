<?php

declare(strict_types=1);

namespace App\Http\Controllers\Profile;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\EmployeeBankAccountRequest;
use App\Http\Requests\EmployeeFamilyRequest;
use App\Http\Resources\EmployeeBankAccountResource;
use App\Http\Resources\EmployeeFamilyMemberResource;
use App\Models\Employee;
use App\Models\EmployeeBankAccount;
use App\Models\EmployeeFamilyMember;
use App\Models\User;
use App\Services\EmployeeBankAccountService;
use App\Services\EmployeeFamilyService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MyDetailsController extends ApiController
{
    public function __construct(
        private readonly EmployeeFamilyService $family,
        private readonly EmployeeBankAccountService $bank
    ) {}

    public function family(Request $request): JsonResponse
    {
        $employee = $this->employee($request->user());

        return ApiResponse::success(
            EmployeeFamilyMemberResource::collection($employee->familyMembers()->orderBy('id')->get()),
            'Family members fetched successfully'
        );
    }

    public function addFamily(EmployeeFamilyRequest $request): JsonResponse
    {
        $employee = $this->employee($request->user());

        return ApiResponse::created(
            new EmployeeFamilyMemberResource(
                $this->family->create($employee, $request->validated(), $request->user())
            ),
            'Family member added successfully'
        );
    }

    public function updateFamily(EmployeeFamilyRequest $request, EmployeeFamilyMember $familyMember): JsonResponse
    {
        $this->assertOwn($request->user(), (int) $familyMember->employee_id);

        return ApiResponse::success(
            new EmployeeFamilyMemberResource(
                $this->family->update($familyMember, $request->validated(), $request->user())
            ),
            'Family member updated successfully'
        );
    }

    public function deleteFamily(Request $request, EmployeeFamilyMember $familyMember): JsonResponse
    {
        $this->assertOwn($request->user(), (int) $familyMember->employee_id);
        $this->family->delete($familyMember);

        return ApiResponse::success(null, 'Family member removed successfully');
    }

    public function bankAccounts(Request $request): JsonResponse
    {
        $employee = $this->employee($request->user());

        return ApiResponse::success(
            EmployeeBankAccountResource::collection($employee->bankAccounts()->orderByDesc('is_primary')->get()),
            'Bank accounts fetched successfully'
        );
    }

    public function addBankAccount(EmployeeBankAccountRequest $request): JsonResponse
    {
        $employee = $this->employee($request->user());

        return ApiResponse::created(
            new EmployeeBankAccountResource(
                $this->bank->create($employee, $request->validated(), $request->user())
            ),
            'Bank account added successfully'
        );
    }

    public function updateBankAccount(EmployeeBankAccountRequest $request, EmployeeBankAccount $bankAccount): JsonResponse
    {
        $this->assertOwn($request->user(), (int) $bankAccount->employee_id);

        return ApiResponse::success(
            new EmployeeBankAccountResource(
                $this->bank->update($bankAccount, $request->validated(), $request->user())
            ),
            'Bank account updated successfully'
        );
    }

    public function deleteBankAccount(Request $request, EmployeeBankAccount $bankAccount): JsonResponse
    {
        $this->assertOwn($request->user(), (int) $bankAccount->employee_id);
        $this->bank->delete($bankAccount);

        return ApiResponse::success(null, 'Bank account removed successfully');
    }

    private function employee(User $user): Employee
    {
        $employee = $user->employee;

        if ($employee === null) {
            throw new ApiException(
                'This account has no employee record yet. Ask HR to onboard it first.',
                422,
                'EMPLOYEE_RECORD_MISSING'
            );
        }

        return $employee;
    }

    private function assertOwn(User $user, int $employeeId): void
    {
        if ($employeeId !== (int) $this->employee($user)->id) {
            throw new ApiException('Not found.', 404, 'NOT_FOUND');
        }
    }
}

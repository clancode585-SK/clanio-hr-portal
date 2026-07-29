<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\EmployeeBankAccountRequest;
use App\Http\Resources\EmployeeBankAccountResource;
use App\Models\Employee;
use App\Models\EmployeeBankAccount;
use App\Services\EmployeeBankAccountService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeBankAccountController extends ApiController
{
    public function __construct(private readonly EmployeeBankAccountService $accounts) {}

    public function index(Employee $employee): JsonResponse
    {
        return ApiResponse::success(
            EmployeeBankAccountResource::collection($employee->bankAccounts()->orderByDesc('is_primary')->get()),
            'Bank accounts fetched successfully'
        );
    }

    public function store(EmployeeBankAccountRequest $request, Employee $employee): JsonResponse
    {
        return ApiResponse::created(
            new EmployeeBankAccountResource($this->accounts->create($employee, $request->validated(), $request->user())),
            'Bank account added successfully'
        );
    }

    public function show(Employee $employee, EmployeeBankAccount $bankAccount): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeBankAccountResource($bankAccount),
            'Bank account details fetched successfully'
        );
    }

    public function update(EmployeeBankAccountRequest $request, Employee $employee, EmployeeBankAccount $bankAccount): JsonResponse
    {
        return ApiResponse::success(
            new EmployeeBankAccountResource($this->accounts->update($bankAccount, $request->validated(), $request->user())),
            'Bank account updated successfully'
        );
    }

    public function destroy(Request $request, Employee $employee, EmployeeBankAccount $bankAccount): JsonResponse
    {
        $this->accounts->delete($bankAccount);

        return ApiResponse::success(null, 'Bank account removed successfully');
    }
}

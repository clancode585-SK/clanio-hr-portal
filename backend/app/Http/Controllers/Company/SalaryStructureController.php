<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\SalaryStructureRequest;
use App\Http\Resources\SalaryStructureResource;
use App\Models\Employee;
use App\Services\SalaryStructureService;
use App\Support\ApiResponse;
use App\Support\CompanyTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalaryStructureController extends ApiController
{
    public function __construct(private readonly SalaryStructureService $structures) {}

    public function index(Request $request, Employee $employee): JsonResponse
    {
        return ApiResponse::success(
            SalaryStructureResource::collection($this->structures->history($employee)),
            'Salary structures fetched successfully'
        );
    }

    public function current(Request $request, Employee $employee): JsonResponse
    {
        $month = $this->month($request);
        $structure = $this->structures->forMonth($employee, $month);

        if ($structure === null) {
            return ApiResponse::success([
                'month' => $month,
                'structure' => null,
                'message' => 'Is mahine ke liye koi structure set nahi hai.',
            ], 'No salary structure for this month');
        }

        return ApiResponse::success([
            'month' => $month,
            'structure' => new SalaryStructureResource($structure->load('lines', 'employee.user')),
        ], 'Salary structure fetched successfully');
    }

    public function store(SalaryStructureRequest $request, Employee $employee): JsonResponse
    {
        return ApiResponse::created(
            new SalaryStructureResource($this->structures->save($employee, $request->validated(), $request->user())),
            'Salary structure saved successfully'
        );
    }

    public function preview(SalaryStructureRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->structures->preview($this->companyId(), $request->validated()),
            'Salary breakup calculated successfully'
        );
    }

    public function coverage(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->structures->coverage($this->companyId(), $this->month($request)),
            'Salary structure coverage fetched successfully'
        );
    }

    private function month(Request $request): string
    {
        $month = (string) $request->query('month', '');

        if (preg_match('/^\d{4}-\d{2}$/', $month) === 1) {
            return $month;
        }

        return CompanyTime::now($this->tenantId())->format('Y-m');
    }

    private function companyId(): int
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'Salary structures belong to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return $id;
    }
}

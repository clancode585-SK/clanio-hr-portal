<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\SalaryComponentRequest;
use App\Http\Resources\SalaryComponentResource;
use App\Models\SalaryComponent;
use App\Services\SalaryStructureService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalaryComponentController extends ApiController
{
    public function __construct(private readonly SalaryStructureService $structures) {}

    public function index(): JsonResponse
    {
        $components = SalaryComponent::query()
            ->orderBy('sequence')
            ->orderBy('id')
            ->get();

        return ApiResponse::success(
            SalaryComponentResource::collection($components),
            'Salary components fetched successfully'
        );
    }

    public function store(SalaryComponentRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new SalaryComponentResource(
                $this->structures->createComponent($this->companyId(), $request->validated(), $request->user())
            ),
            'Salary component added successfully'
        );
    }

    public function update(SalaryComponentRequest $request, SalaryComponent $salaryComponent): JsonResponse
    {
        return ApiResponse::success(
            new SalaryComponentResource(
                $this->structures->updateComponent($salaryComponent, $request->validated(), $request->user())
            ),
            'Salary component updated successfully'
        );
    }

    public function destroy(SalaryComponent $salaryComponent): JsonResponse
    {
        $this->structures->deleteComponent($salaryComponent);

        return ApiResponse::success(null, 'Salary component removed successfully');
    }

    public function standard(Request $request): JsonResponse
    {
        $result = $this->structures->standardComponents($this->companyId(), $request->user());

        return ApiResponse::success(
            $result + ['components' => SalaryComponentResource::collection(
                SalaryComponent::query()->orderBy('sequence')->get()
            )],
            $result['created'] === 0
                ? 'Standard components already set up'
                : $result['created'] . ' standard components ban gaye'
        );
    }

    private function companyId(): int
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'Salary components belong to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return $id;
    }
}

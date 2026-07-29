<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\CompanyRequest;
use App\Http\Resources\CompanyResource;
use App\Http\Resources\UserResource;
use App\Models\Company;
use App\Services\CompanyService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanyController extends ApiController
{
    public function __construct(private readonly CompanyService $companies) {}

    public function index(Request $request): JsonResponse
    {
        $companies = TenantCache::remember(
            TenantCache::COMPANIES,
            $this->cacheKey($request),
            fn () => $this->applyFilters(
                Company::query(),
                $request,
                ['name', 'slug', 'email'],
                ['status' => 'status']
            )->latest('id')->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($companies, CompanyResource::class, 'Companies fetched successfully');
    }

    public function store(CompanyRequest $request): JsonResponse
    {
        $company = $this->companies->create($request->validated(), $request->user());

        return ApiResponse::created([
            'company' => new CompanyResource($company),
            'admin' => new UserResource($company->getRelation('adminUser')),
        ], 'Company and administrator created successfully');
    }

    public function show(Company $company): JsonResponse
    {
        return ApiResponse::success(new CompanyResource($company), 'Company details fetched successfully');
    }

    public function update(CompanyRequest $request, Company $company): JsonResponse
    {
        return ApiResponse::success(
            new CompanyResource($this->companies->update($company, $request->validated(), $request->user())),
            'Company updated successfully'
        );
    }

    public function destroy(Company $company): JsonResponse
    {
        $this->companies->delete($company);

        return ApiResponse::success(null, 'Company archived successfully');
    }
}

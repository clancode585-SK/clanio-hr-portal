<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\BranchRequest;
use App\Http\Resources\BranchResource;
use App\Models\Branch;
use App\Services\BranchService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchController extends ApiController
{
    public function __construct(private readonly BranchService $branches) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Branch::query();

        if ($user?->isSuperAdmin() && app(\App\Support\TenantContext::class)->id() === null) {
            $query = Branch::withoutGlobalScopes();
        }

        $branches = TenantCache::remember(
            TenantCache::BRANCHES,
            $this->cacheKey($request) . ($user?->isSuperAdmin() ? '_super' : ''),
            fn () => $this->applyFilters(
                $query->with(['company'])->withCount('users'),
                $request,
                ['name', 'code'],
                ['status' => 'status']
            )->orderBy('name')->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($branches, BranchResource::class, 'Branches fetched successfully');
    }

    public function store(BranchRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new BranchResource($this->branches->create($request->validated(), $request->user(), $this->tenantId())),
            'Branch created successfully'
        );
    }

    public function show(Branch $branch): JsonResponse
    {
        return ApiResponse::success(
            new BranchResource($branch->loadCount('users')),
            'Branch details fetched successfully'
        );
    }

    public function update(BranchRequest $request, Branch $branch): JsonResponse
    {
        return ApiResponse::success(
            new BranchResource($this->branches->update($branch, $request->validated(), $request->user())),
            'Branch updated successfully'
        );
    }

    public function destroy(Branch $branch): JsonResponse
    {
        $this->branches->delete($branch);

        return ApiResponse::success(null, 'Branch deleted successfully');
    }
}

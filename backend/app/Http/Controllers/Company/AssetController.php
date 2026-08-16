<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\AssetAllocationRequest;
use App\Http\Requests\AssetStoreRequest;
use App\Http\Resources\AssetAllocationResource;
use App\Http\Resources\AssetResource;
use App\Models\Asset;
use App\Services\AssetService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetController extends ApiController
{
    public function __construct(private readonly AssetService $assets) {}

    public function categories(): JsonResponse
    {
        $categories = [];

        foreach (Asset::CATEGORIES as $value => $label) {
            $categories[] = ['value' => $value, 'label' => $label];
        }

        return ApiResponse::success([
            'categories' => $categories,
            'statuses' => Asset::STATUSES,
            'conditions' => Asset::CONDITIONS,
        ], 'Asset categories fetched successfully');
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success($this->assets->summary($request->user()), 'Asset summary fetched successfully');
    }

    public function index(Request $request): JsonResponse
    {
        $assets = $this->applyFilters(
            Asset::query()->with('currentAllocation.employee.user'),
            $request,
            ['asset_code', 'name', 'serial_number', 'brand', 'model'],
            [
                'category' => 'category',
                'status' => 'status',
                'condition_state' => 'condition_state',
            ]
        )->orderByDesc('id')->paginate($this->perPage($request));

        return ApiResponse::paginated($assets, AssetResource::class, 'Assets fetched successfully');
    }

    public function myAssets(Request $request): JsonResponse
    {
        return ApiResponse::success(
            AssetAllocationResource::collection($this->assets->allocatedTo(
                $request->user(),
                $request->filled('employee_id') ? (int) $request->input('employee_id') : null
            )),
            'Allocated assets fetched successfully'
        );
    }

    public function store(AssetStoreRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new AssetResource($this->assets->create($request->validated(), $request->user(), $this->tenantId())),
            'Asset add ho gaya'
        );
    }

    public function show(Asset $asset): JsonResponse
    {
        return ApiResponse::success(
            new AssetResource($asset->load('currentAllocation.employee.user')),
            'Asset fetched successfully'
        );
    }

    public function update(AssetStoreRequest $request, Asset $asset): JsonResponse
    {
        return ApiResponse::success(
            new AssetResource($this->assets->update($asset, $request->validated(), $request->user())),
            'Asset update ho gaya'
        );
    }

    public function allocate(AssetAllocationRequest $request, Asset $asset): JsonResponse
    {
        return ApiResponse::created(
            new AssetAllocationResource($this->assets->allocate($asset, $request->validated(), $request->user())),
            'Asset allocate ho gaya'
        );
    }

    public function returnAsset(AssetAllocationRequest $request, Asset $asset): JsonResponse
    {
        return ApiResponse::success(
            new AssetAllocationResource($this->assets->returnAsset($asset, $request->validated(), $request->user())),
            'Asset wapas mil gaya'
        );
    }

    public function retire(AssetAllocationRequest $request, Asset $asset): JsonResponse
    {
        return ApiResponse::success(
            new AssetResource($this->assets->retire($asset, $request->validated(), $request->user())),
            'Asset retire ho gaya'
        );
    }

    public function history(Asset $asset): JsonResponse
    {
        return ApiResponse::success(
            AssetAllocationResource::collection($this->assets->historyFor($asset)),
            'Asset history fetched successfully'
        );
    }

    public function destroy(Request $request, Asset $asset): JsonResponse
    {
        $this->assets->delete($asset, $request->user());

        return ApiResponse::success(null, 'Asset hata diya gaya');
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\AssetRequestRequest;
use App\Http\Resources\AssetRequestResource;
use App\Models\AssetRequest;
use App\Services\AssetRequestService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetRequestController extends ApiController
{
    public function __construct(private readonly AssetRequestService $requests) {}

    public function types(): JsonResponse
    {
        $types = [];

        foreach (AssetRequest::TYPES as $value => $label) {
            $types[] = [
                'value' => $value,
                'label' => $label,
                'needs_asset' => $value !== AssetRequest::TYPE_NEW,
            ];
        }

        return ApiResponse::success([
            'request_types' => $types,
            'priorities' => AssetRequest::PRIORITIES,
            'statuses' => AssetRequest::STATUSES,
        ], 'Asset request types fetched successfully');
    }

    public function index(Request $request): JsonResponse
    {
        $requests = $this->scoped($request)->paginate($this->perPage($request));

        return ApiResponse::paginated($requests, AssetRequestResource::class, 'Asset requests fetched successfully');
    }

    public function pending(Request $request): JsonResponse
    {
        $requests = $this->scoped($request)
            ->whereIn('status', [AssetRequest::PENDING, AssetRequest::APPROVED, AssetRequest::IN_PROGRESS])
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($requests, AssetRequestResource::class, 'Open asset requests fetched successfully');
    }

    public function store(AssetRequestRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new AssetRequestResource($this->requests->raise($request->user(), $request->validated())),
            'Request bhej di gayi — IT dekhega'
        );
    }

    public function show(AssetRequest $assetRequest): JsonResponse
    {
        return ApiResponse::success(
            new AssetRequestResource($assetRequest->load('employee.user', 'asset', 'handler')),
            'Asset request fetched successfully'
        );
    }

    public function update(AssetRequestRequest $request, AssetRequest $assetRequest): JsonResponse
    {
        return ApiResponse::success(
            new AssetRequestResource($this->requests->update($assetRequest, $request->validated(), $request->user())),
            'Request update ho gayi'
        );
    }

    public function approve(AssetRequestRequest $request, AssetRequest $assetRequest): JsonResponse
    {
        return ApiResponse::success(
            new AssetRequestResource($this->requests->approve($assetRequest, $request->validated(), $request->user())),
            'Request approve ho gayi'
        );
    }

    public function reject(AssetRequestRequest $request, AssetRequest $assetRequest): JsonResponse
    {
        return ApiResponse::success(
            new AssetRequestResource($this->requests->reject($assetRequest, $request->validated(), $request->user())),
            'Request reject kar di gayi'
        );
    }

    public function start(Request $request, AssetRequest $assetRequest): JsonResponse
    {
        return ApiResponse::success(
            new AssetRequestResource($this->requests->start($assetRequest, $request->user())),
            'Kaam shuru ho gaya'
        );
    }

    public function resolve(AssetRequestRequest $request, AssetRequest $assetRequest): JsonResponse
    {
        return ApiResponse::success(
            new AssetRequestResource($this->requests->resolve($assetRequest, $request->validated(), $request->user())),
            'Request complete ho gayi'
        );
    }

    public function destroy(Request $request, AssetRequest $assetRequest): JsonResponse
    {
        return ApiResponse::success(
            new AssetRequestResource($this->requests->cancel($assetRequest, $request->user())),
            'Request cancel ho gayi'
        );
    }

    private function scoped(Request $request): Builder
    {
        return $this->applyFilters(
            AssetRequest::query()
                ->with('employee.user', 'asset', 'handler')
                ->visibleTo($request->user()),
            $request,
            ['title', 'description'],
            [
                'status' => 'status',
                'request_type' => 'request_type',
                'priority' => 'priority',
                'employee_id' => 'employee_id',
                'asset_id' => 'asset_id',
            ]
        )
            ->orderByRaw("FIELD(priority, 'urgent', 'high', 'normal', 'low')")
            ->orderByRaw("FIELD(status, 'pending', 'approved', 'in_progress', 'resolved', 'rejected', 'cancelled')")
            ->orderByDesc('id');
    }
}

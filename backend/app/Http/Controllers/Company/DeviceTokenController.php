<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\DeviceTokenRequest;
use App\Http\Resources\DeviceTokenResource;
use App\Models\DeviceToken;
use App\Services\PushService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceTokenController extends ApiController
{
    public function __construct(private readonly PushService $push) {}

    public function index(Request $request): JsonResponse
    {
        return ApiResponse::success(
            DeviceTokenResource::collection(
                DeviceToken::query()->forUser($request->user())->active()->orderByDesc('id')->get()
            ),
            'Devices fetched successfully'
        );
    }

    public function store(DeviceTokenRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new DeviceTokenResource($this->push->register($request->user(), $request->validated())),
            'Device registered successfully'
        );
    }

    public function destroy(DeviceToken $deviceToken): JsonResponse
    {
        $deviceToken->revoke();

        return ApiResponse::success(null, 'Device unregistered successfully');
    }
}

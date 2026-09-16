<?php

declare(strict_types=1);

namespace App\Http\Controllers\Profile;

use App\Http\Controllers\ApiController;
use App\Services\OnboardingService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnboardingController extends ApiController
{
    public function __construct(private readonly OnboardingService $onboarding) {}

    public function show(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->onboarding->state($request->user()),
            'Onboarding state fetched successfully'
        );
    }

    public function profileSeen(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->onboarding->markProfileSeen($request->user()),
            'You can finish your profile any time from My Profile'
        );
    }

    public function tourDone(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->onboarding->markTourDone($request->user()),
            'Tour closed. It will not come up again'
        );
    }

    public function tourReset(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->onboarding->resetTour($request->user()),
            'Tour will show again the next time you open the app'
        );
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\ApiController;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Services\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends ApiController
{
    public function __construct(private readonly AuthService $auth) {}

    public function login(LoginRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->auth->login($request->validated(), $request),
            'Logged in successfully'
        );
    }

    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request);

        return ApiResponse::success(null, 'Logged out successfully');
    }

    public function refresh(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->auth->refresh($request->user(), $request),
            'Session aage badha diya gaya'
        );
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $data = $request->validate(['keep_current' => ['nullable', 'boolean']]);
        $keep = (bool) ($data['keep_current'] ?? true);

        $count = $this->auth->logoutEverywhere($request->user(), $request, $keep);

        return ApiResponse::success(
            ['revoked' => $count],
            $count === 0
                ? 'Koi aur device signed in nahi tha'
                : $count . ' device se sign out kar diya'
                    . ($keep ? ' — ye wala chalu hai' : '')
        );
    }

    public function sessions(Request $request): JsonResponse
    {
        return ApiResponse::success(
            ['sessions' => $this->auth->sessions($request->user(), $request)],
            'Sessions fetched successfully'
        );
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $this->auth->forgotPassword($request->validated(), $request);

        return ApiResponse::success(null, 'If that account exists, a reset link has been emailed.');
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $this->auth->resetPassword($request->validated());

        return ApiResponse::success(null, 'Password reset successfully. Please log in.');
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->auth->changePassword(
            $request->user(),
            $request->validated('current_password'),
            $request->validated('password')
        );

        return ApiResponse::success(null, 'Password changed. Please log in again.');
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Mail\PasswordResetMail;
use App\Models\ApiToken;
use App\Models\Company;
use App\Models\LoginAttempt;
use App\Models\PasswordResetToken;
use App\Models\User;
use App\Support\Scopes\CompanyScope;
use App\Services\PolicyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

final class AuthService
{
    public function login(array $credentials, Request $request): array
    {
        $email = $credentials['email'];
        $user = $this->resolveUser($email, $credentials['company_slug'] ?? null, $request);

        if ($user->isLocked()) {
            $this->log($email, $user, 'account_locked', $request);

            throw new ApiException('Account is locked. Try again later.', 423, 'AUTH_ACCOUNT_LOCKED');
        }

        if (! Hash::check($credentials['password'], $user->password)) {
            $user->registerFailedLogin($this->config('max_login_attempts', 5), $this->config('lock_minutes', 15));
            $this->log($email, $user, 'invalid_password', $request);

            throw new ApiException('These credentials do not match our records.', 401, 'AUTH_INVALID_CREDENTIALS');
        }

        if (! $user->isActive()) {
            $this->log($email, $user, 'inactive_account', $request);

            throw new ApiException('This account is ' . $user->status . '.', 403, 'AUTH_ACCOUNT_INACTIVE');
        }

        $this->guardCompany($user, $email, $request);

        $user->registerLogin($request->ip());
        $this->log($email, $user, null, $request, true);

        $gate = app(PolicyService::class)->gateStatus($user);

        return [
            'token' => ApiToken::issue($user, $request->ip(), $this->config('lifetime', 10080)),
            'role' => $user->primaryRole(),
            'policy_gate' => [
                'blocked' => $gate['blocked'],
                'pending' => $gate['pending'],
            ],
        ];
    }

    public function logout(Request $request): void
    {
        $token = $request->attributes->get('api_token');

        if ($token instanceof ApiToken) {
            $token->revoke();
        }
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        if (! Hash::check($currentPassword, $user->password)) {
            throw new ApiException('Current password is incorrect.', 422, 'AUTH_PASSWORD_MISMATCH');
        }

        $user->forceFill(['password' => $newPassword])->save();
        $user->revokeTokens();
    }

    public function forgotPassword(array $data, Request $request): void
    {
        $user = $this->findForReset($data['email'], $data['company_slug'] ?? null);

        if ($user === null || ! $user->isActive()) {
            return;
        }

        $token = PasswordResetToken::issue($user, $request->ip(), $this->config('reset_minutes', 60));

        Mail::to($user->email)->send(new PasswordResetMail($user, $token));
    }

    public function resetPassword(array $data): void
    {
        $reset = PasswordResetToken::findValid($data['token']);

        if ($reset === null) {
            throw new ApiException('This reset link is invalid or has expired.', 422, 'RESET_TOKEN_INVALID');
        }

        $user = User::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->whereKey($reset->user_id)
            ->first();

        if ($user === null || ! $user->isActive()) {
            throw new ApiException('This account can no longer be reset.', 422, 'RESET_TOKEN_INVALID');
        }

        DB::transaction(function () use ($user, $reset, $data): void {
            $user->forceFill([
                'password' => $data['password'],
                'failed_login_attempts' => 0,
                'locked_until' => null,
            ])->save();

            $user->revokeTokens();
            $reset->consume();
        });
    }

    private function findForReset(string $email, ?string $companySlug): ?User
    {
        $query = User::query()->withoutGlobalScope(CompanyScope::class)->where('email', $email);

        if (! empty($companySlug)) {
            $query->where('company_id', Company::query()->where('slug', $companySlug)->value('id'));
        }

        $users = $query->get();

        return $users->count() === 1 ? $users->first() : null;
    }

    private function resolveUser(string $email, ?string $companySlug, Request $request): User
    {
        $query = User::query()->withoutGlobalScope(CompanyScope::class)->where('email', $email);

        if (! empty($companySlug)) {
            $companyId = Company::query()->where('slug', $companySlug)->value('id');

            if ($companyId === null) {
                $this->log($email, null, 'company_not_found', $request);

                throw new ApiException('These credentials do not match our records.', 401, 'AUTH_INVALID_CREDENTIALS');
            }

            $query->where('company_id', $companyId);
        }

        $users = $query->get();

        if ($users->count() > 1) {
            throw new ApiException('This email exists in multiple companies. Send company_slug.', 409, 'AUTH_COMPANY_REQUIRED');
        }

        if ($users->isEmpty()) {
            $this->log($email, null, 'user_not_found', $request);

            throw new ApiException('These credentials do not match our records.', 401, 'AUTH_INVALID_CREDENTIALS');
        }

        return $users->first();
    }

    private function guardCompany(User $user, string $email, Request $request): void
    {
        if ($user->company_id === null) {
            return;
        }

        $status = Company::query()->whereKey($user->company_id)->value('status');

        if ($status !== 'active') {
            $this->log($email, $user, 'company_inactive', $request);

            throw new ApiException('This company account is not active.', 402, 'TENANT_SUSPENDED');
        }
    }

    private function log(string $email, ?User $user, ?string $reason, Request $request, bool $successful = false): void
    {
        LoginAttempt::create([
            'email' => $email,
            'user_id' => $user?->id,
            'company_id' => $user?->company_id,
            'ip_address' => $request->ip(),
            'successful' => $successful,
            'reason' => $reason,
        ]);
    }

    private function config(string $key, int $default): int
    {
        return (int) config('auth.token.' . $key, $default);
    }
}

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
use App\Services\OnboardingService;
use App\Services\PolicyService;
use App\Support\Scopes\CompanyScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

final class AuthService
{
    private const REFRESH_GRACE_MINUTES = 2;

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
            'token' => ApiToken::issue($user, $request->ip(), $this->config('lifetime', 10080), $request->userAgent()),
            'role' => $user->primaryRole(),
            'policy_gate' => [
                'blocked' => $gate['blocked'],
                'pending' => $gate['pending'],
            ],
            'onboarding' => app(OnboardingService::class)->state($user),
        ];
    }

    public function logout(Request $request): void
    {
        $token = $request->attributes->get('api_token');

        if ($token instanceof ApiToken) {
            $token->revoke();
        }
    }

    /** Purana token revoke, naya de do — session aage badh jaata hai */
    public function refresh(User $user, Request $request): array
    {
        $current = $request->attributes->get('api_token');

        if (! $current instanceof ApiToken) {
            throw new ApiException('Token nahi mila.', 401, 'AUTH_TOKEN_MISSING');
        }

        $fresh = ApiToken::issue(
            $user,
            $request->ip(),
            $this->config('lifetime', 10080),
            $request->userAgent()
        );

        // Purana token turant nahi marta — jo request abhi chal rahi hain wo 401 na khaayein
        $current->forceFill(['expires_at' => now()->addMinutes(self::REFRESH_GRACE_MINUTES)])->save();

        return [
            'token' => $fresh,
            'expires_in_minutes' => (int) $this->config('lifetime', 10080),
            'old_token_valid_for_minutes' => self::REFRESH_GRACE_MINUTES,
        ];
    }

    public function logoutEverywhere(User $user, Request $request, bool $keepCurrent): int
    {
        $current = $request->attributes->get('api_token');
        $exceptId = $keepCurrent && $current instanceof ApiToken ? (int) $current->id : null;

        return ApiToken::revokeAllFor($user, $exceptId);
    }

    public function sessions(User $user, Request $request): array
    {
        $current = $request->attributes->get('api_token');
        $currentId = $current instanceof ApiToken ? (int) $current->id : null;

        return ApiToken::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->orderByDesc('last_used_at')
            ->orderByDesc('id')
            ->get(['id', 'ip_address', 'user_agent', 'last_used_at', 'expires_at', 'created_at'])
            ->map(fn (ApiToken $token): array => [
                'id' => (int) $token->id,
                'is_current' => (int) $token->id === $currentId,
                'ip_address' => $token->ip_address,
                'device' => $this->device($token->user_agent),
                'last_used_at' => $token->last_used_at?->toIso8601String(),
                'expires_at' => $token->expires_at?->toIso8601String(),
                'signed_in_at' => $token->created_at?->toIso8601String(),
            ])
            ->all();
    }

    // User agent se mota-moti device ka naam
    private function device(?string $agent): string
    {
        if ($agent === null || $agent === '') {
            return 'Unknown device';
        }

        return match (true) {
            str_contains($agent, 'Android') => 'Android',
            str_contains($agent, 'iPhone') => 'iPhone',
            str_contains($agent, 'iPad') => 'iPad',
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'Macintosh') => 'Mac',
            str_contains($agent, 'Linux') => 'Linux',
            default => 'Unknown device',
        };
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

        if ($users->isEmpty()) {
            $this->log($email, null, 'user_not_found', $request);

            throw new ApiException('These credentials do not match our records.', 401, 'AUTH_INVALID_CREDENTIALS');
        }

        if ($users->count() === 1) {
            return $users->first();
        }

        $password = (string) $request->input('password');
        $matched = $users->filter(fn (User $user): bool => Hash::check($password, (string) $user->password));

        if ($matched->count() === 1) {
            return $matched->first();
        }

        if ($matched->isEmpty()) {
            foreach ($users as $user) {
                $user->registerFailedLogin($this->config('max_login_attempts', 5), $this->config('lock_minutes', 15));
            }

            $this->log($email, $users->first(), 'invalid_password', $request);

            throw new ApiException('These credentials do not match our records.', 401, 'AUTH_INVALID_CREDENTIALS');
        }

        $companies = Company::query()
            ->withoutGlobalScopes()
            ->whereIn('id', $matched->pluck('company_id')->filter()->all())
            ->get(['slug', 'name'])
            ->map(fn (Company $company): array => ['slug' => $company->slug, 'name' => $company->name])
            ->all();

        throw new ApiException(
            'You work at more than one company here. Pick which workspace to open.',
            409,
            'AUTH_COMPANY_REQUIRED',
            ['companies' => $companies]
        );
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

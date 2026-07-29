<?php

declare(strict_types=1);

namespace App\Providers;

use App\Auth\ApiTokenGuard;
use App\Support\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TenantContext::class);
    }

    public function boot(): void
    {
        Auth::viaRequest('api-token', fn (Request $request) => app(ApiTokenGuard::class)($request));

        $this->registerRateLimiters();
    }

    private function registerRateLimiters(): void
    {
        RateLimiter::for('login', fn (Request $request): array => [
            Limit::perMinute(5)->by($request->ip() . '|' . Str::lower((string) $request->input('email'))),
            Limit::perHour(30)->by((string) $request->ip()),
        ]);

        RateLimiter::for('api', fn (Request $request): array => [
            Limit::perMinute(120)->by('user:' . ($request->user()?->id ?? $request->ip())),
            Limit::perMinute(3000)->by('company:' . ($request->user()?->company_id ?? 'platform')),
        ]);

        RateLimiter::for('sensitive', fn (Request $request): Limit => Limit::perHour(20)
            ->by('sensitive:' . ($request->user()?->id ?? $request->ip())));
    }
}

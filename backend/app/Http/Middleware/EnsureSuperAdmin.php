<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()->isSuperAdmin()) {
            return ApiResponse::error('Super admin access is required.', 403, 'SUPER_ADMIN_REQUIRED');
        }

        return $next($request);
    }
}

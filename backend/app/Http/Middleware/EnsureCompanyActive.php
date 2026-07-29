<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureCompanyActive
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $company = $this->tenant->company();

        if ($company !== null && $company->status !== 'active') {
            return ApiResponse::error(
                'This company account is ' . $company->status . '.',
                402,
                'TENANT_SUSPENDED'
            );
        }

        return $next($request);
    }
}

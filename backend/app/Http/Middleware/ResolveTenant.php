<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Company;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class ResolveTenant
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user->isSuperAdmin()) {
            return $this->resolveImpersonation($request, $next);
        }

        if ($user->company_id === null) {
            return ApiResponse::error('User is not linked to any company.', 403, 'TENANT_MISSING');
        }

        $company = Company::query()->find($user->company_id);

        if ($company === null) {
            return ApiResponse::error('Company not found.', 403, 'TENANT_NOT_FOUND');
        }

        $this->tenant->set($company);

        return $next($request);
    }

    private function resolveImpersonation(Request $request, Closure $next): Response
    {
        $companyId = $request->header('X-Company-Id');

        if ($companyId === null) {
            return $next($request);
        }

        $company = Company::query()->find((int) $companyId);

        if ($company === null) {
            return ApiResponse::error('Company not found.', 404, 'TENANT_NOT_FOUND');
        }

        $this->tenant->set($company);

        return $next($request);
    }
}

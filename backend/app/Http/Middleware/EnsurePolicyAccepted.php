<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\PolicyService;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePolicyAccepted
{
    private const ALLOWED = [
        'auth/logout',
        'auth/change-password',
        'profile',
        'profile/completion',
        'my-policies',
        'notifications',
        'realtime/config',
    ];

    public function __construct(private readonly PolicyService $policies) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $this->isAllowed($request)) {
            return $next($request);
        }

        $status = $this->policies->gateStatus($user);

        if (! $status['blocked']) {
            return $next($request);
        }

        return ApiResponse::error(
            'Pehle company ki saari policies accept karo, phir tool khulega. '
                . $status['pending'] . ' baaki hain.',
            403,
            'POLICY_ACCEPTANCE_PENDING',
            ['pending' => $status['pending']]
        );
    }

    private function isAllowed(Request $request): bool
    {
        $path = trim(str_replace('api/hrms', '', $request->path()), '/');

        foreach (self::ALLOWED as $allowed) {
            if ($path === $allowed || str_starts_with($path, $allowed . '/')) {
                return true;
            }
        }

        return str_starts_with($path, 'policies/') && $request->isMethod('GET')
            || str_starts_with($path, 'policies/') && str_ends_with($path, '/acknowledge');
    }
}

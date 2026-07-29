<?php

declare(strict_types=1);

namespace App\Auth;

use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Http\Request;

final class ApiTokenGuard
{
    public function __invoke(Request $request): ?User
    {
        $plainToken = $request->bearerToken();

        if ($plainToken === null || $plainToken === '') {
            return null;
        }

        $token = ApiToken::query()
            ->where('token_hash', ApiToken::hashFor($plainToken))
            ->first();

        if ($token === null || ! $token->isValid()) {
            return null;
        }

        $user = User::query()
            ->withoutGlobalScopes()
            ->where('id', $token->user_id)
            ->whereNull('deleted_at')
            ->first();

        if ($user === null || ! $user->isActive() || $user->isLocked()) {
            return null;
        }

        $token->touchLastUsed();
        $request->attributes->set('api_token', $token);

        return $user;
    }
}

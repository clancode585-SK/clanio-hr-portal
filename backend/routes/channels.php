<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{userId}', fn (User $user, string $userId): bool => (int) $user->id === (int) $userId);

Broadcast::channel(
    'company.{companyId}',
    fn (User $user, string $companyId): bool => $user->isSuperAdmin() || (int) $user->company_id === (int) $companyId
);

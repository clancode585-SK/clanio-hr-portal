<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ApiToken extends Model
{
    protected $guarded = [];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function hashFor(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    public static function issue(User $user, ?string $ip, int $lifetimeMinutes): string
    {
        $plainToken = Str::random(80);

        self::create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'token_hash' => self::hashFor($plainToken),
            'ip_address' => $ip,
            'expires_at' => now()->addMinutes($lifetimeMinutes),
        ]);

        return $plainToken;
    }

    public function isValid(): bool
    {
        return $this->revoked_at === null
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function revoke(): void
    {
        $this->forceFill(['revoked_at' => now()])->save();
    }

    public function touchLastUsed(): void
    {
        if ($this->last_used_at === null || $this->last_used_at->lt(now()->subMinute())) {
            $this->forceFill(['last_used_at' => now()])->saveQuietly();
        }
    }
}

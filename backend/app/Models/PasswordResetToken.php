<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class PasswordResetToken extends Model
{
    protected $fillable = [
        'user_id',
        'company_id',
        'email',
        'token_hash',
        'ip_address',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public static function issue(User $user, ?string $ip, int $minutes): string
    {
        self::query()->where('user_id', $user->id)->whereNull('used_at')->delete();

        $token = Str::random(64);

        self::query()->create([
            'user_id' => $user->id,
            'company_id' => $user->company_id,
            'email' => $user->email,
            'token_hash' => hash('sha256', $token),
            'ip_address' => $ip,
            'expires_at' => Carbon::now()->addMinutes($minutes),
        ]);

        return $token;
    }

    public static function findValid(string $token): ?self
    {
        return self::query()
            ->where('token_hash', hash('sha256', $token))
            ->whereNull('used_at')
            ->where('expires_at', '>', Carbon::now())
            ->first();
    }

    public function consume(): void
    {
        $this->forceFill(['used_at' => Carbon::now()])->save();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

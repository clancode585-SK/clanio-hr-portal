<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class DeviceToken extends Model
{
    use BelongsToCompany;
    use HasUuid;

    public const ANDROID = 'android';

    public const IOS = 'ios';

    public const WEB = 'web';

    public const PLATFORMS = [self::ANDROID, self::IOS, self::WEB];

    protected $fillable = [
        'platform',
        'token',
        'device_id',
        'device_name',
        'app_version',
    ];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->where('user_id', $user->id);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('revoked_at');
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->forUser(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function revoke(): void
    {
        $this->forceFill(['revoked_at' => Carbon::now()])->save();
    }

    public function maskedToken(): string
    {
        return substr($this->token, 0, 8) . '...' . substr($this->token, -6);
    }
}

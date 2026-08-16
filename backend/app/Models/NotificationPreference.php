<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    use BelongsToCompany;
    use HasUuid;

    protected $fillable = [
        'scope',
        'in_app',
        'push',
        'email',
    ];

    protected $attributes = [
        'in_app' => true,
        'push' => true,
        'email' => false,
    ];

    protected function casts(): array
    {
        return [
            'in_app' => 'boolean',
            'push' => 'boolean',
            'email' => 'boolean',
        ];
    }

    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->where('user_id', $user->id);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use App\Support\NotificationType;
use App\Support\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class Notification extends Model
{
    use BelongsToCompany;
    use HasUuid;

    protected $fillable = [
        'type',
        'group_name',
        'priority',
        'title',
        'body',
        'action_url',
        'entity_type',
        'entity_id',
        'payload',
        'dedupe_key',
    ];

    protected $attributes = [
        'priority' => NotificationType::NORMAL,
    ];

    protected $hidden = ['dedupe_slot'];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'read_at' => 'datetime',
        ];
    }

    /**
     * Notification kisi ek user ka hota hai, company ka nahi. Company scope isko
     * platform console par chhupa deta tha — super admin ko apni hi notification
     * nahi dikhti thi. user_id hi asli boundary hai.
     */
    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->withoutGlobalScope(CompanyScope::class)->where('user_id', $user->id);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
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

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    public function markRead(): bool
    {
        if ($this->isRead()) {
            return false;
        }

        $this->forceFill(['read_at' => Carbon::now()])->save();

        return true;
    }
}

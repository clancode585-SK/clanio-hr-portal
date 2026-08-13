<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use App\Support\DataScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Recognition extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const KUDOS = 'kudos';

    public const BADGE = 'badge';

    public const SPOT_AWARD = 'spot_award';

    public const TYPES = [
        self::KUDOS => 'Kudos',
        self::BADGE => 'Badge',
        self::SPOT_AWARD => 'Spot award',
    ];

    public const PUBLIC = 'public';

    public const PRIVATE = 'private';

    public const GIVE_PERMISSION = 'recognition.give';

    protected $fillable = [
        'type',
        'title',
        'message',
        'points',
        'visibility',
        'awarded_on',
    ];

    protected $attributes = [
        'type' => self::KUDOS,
        'visibility' => self::PUBLIC,
        'points' => 0,
        'is_auto' => false,
    ];

    protected $hidden = ['goal_key'];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'is_auto' => 'boolean',
            'awarded_on' => 'date:Y-m-d',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['goal_key', 'created_at', 'updated_at'];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        return $query->where(fn (Builder $inner) => $inner
            ->where('visibility', self::PUBLIC)
            ->orWhereHas('employee', fn (Builder $employee) => $employee
                ->where('user_id', $actor->id)
                ->orWhere('reporting_manager_id', $actor->id)));
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->visibleTo(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function giver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'given_by');
    }

    public function goal(): BelongsTo
    {
        return $this->belongsTo(PerformanceGoal::class, 'performance_goal_id');
    }

    public function typeLabel(): string
    {
        return self::TYPES[$this->type] ?? $this->type;
    }
}

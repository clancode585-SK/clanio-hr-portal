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

class Appraisal extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    /** Employee ne self review nahi bhara */
    public const PENDING = 'pending';

    /** Self review ho gaya — manager ke paas */
    public const SELF_DONE = 'self_done';

    /** Manager ne rating de di — HR ke paas */
    public const MANAGER_DONE = 'manager_done';

    /** HR ne final rating de di */
    public const FINALISED = 'finalised';

    public const STATUSES = [
        self::PENDING,
        self::SELF_DONE,
        self::MANAGER_DONE,
        self::FINALISED,
    ];

    protected $fillable = [
        'self_rating',
        'self_comments',
        'manager_rating',
        'manager_comments',
        'final_rating',
        'final_comments',
    ];

    protected $attributes = [
        'status' => self::PENDING,
    ];

    protected function casts(): array
    {
        return [
            'auto_score' => 'integer',
            'goal_achievement_percent' => 'integer',
            'self_rating' => 'float',
            'manager_rating' => 'float',
            'final_rating' => 'float',
            'self_submitted_at' => 'datetime',
            'manager_submitted_at' => 'datetime',
            'finalised_at' => 'datetime',
        ];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        if ($actor->hasPermission(AppraisalCycle::MANAGE_PERMISSION)) {
            return $query;
        }

        return $query->where(fn (Builder $inner) => $inner
            ->where('manager_id', $actor->id)
            ->orWhereHas('employee', fn (Builder $employee) => $employee->where('user_id', $actor->id)));
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

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(AppraisalCycle::class, 'appraisal_cycle_id');
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function hr(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hr_id');
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isSelfDone(): bool
    {
        return $this->status === self::SELF_DONE;
    }

    public function isManagerDone(): bool
    {
        return $this->status === self::MANAGER_DONE;
    }

    public function isFinalised(): bool
    {
        return $this->status === self::FINALISED;
    }

    public function stageLabel(): string
    {
        return match ($this->status) {
            self::PENDING => 'Self review pending',
            self::SELF_DONE => 'Manager review pending',
            self::MANAGER_DONE => 'HR final rating pending',
            self::FINALISED => 'Finalised',
            default => $this->status,
        };
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use App\Support\DataScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

class Task extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    public const TODO = 'todo';

    public const IN_PROGRESS = 'in_progress';

    public const BLOCKED = 'blocked';

    public const DONE = 'done';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [self::TODO, self::IN_PROGRESS, self::BLOCKED, self::DONE, self::CANCELLED];

    public const CLOSED_STATUSES = [self::DONE, self::CANCELLED];

    public const LOW = 'low';

    public const NORMAL = 'normal';

    public const HIGH = 'high';

    public const URGENT = 'urgent';

    public const PRIORITIES = [self::LOW, self::NORMAL, self::HIGH, self::URGENT];

    public const EDIT_PERMISSION = 'task.edit';

    public const DELETE_PERMISSION = 'task.delete';

    protected $fillable = [
        'title',
        'description',
        'priority',
        'due_date',
        'estimated_hours',
        'blocked_reason',
    ];

    protected $attributes = [
        'status' => self::TODO,
        'priority' => self::NORMAL,
        'spent_hours' => 0,
    ];

    protected $hidden = ['is_open'];

    protected function casts(): array
    {
        return [
            'due_date' => 'date:Y-m-d',
            'estimated_hours' => 'float',
            'spent_hours' => 'float',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        return $query->where(fn (Builder $inner) => $inner
            ->where('assignee_id', $actor->id)
            ->orWhere('assigned_by', $actor->id)
            ->orWhereHas('assignee.employee', fn (Builder $employee) => $employee
                ->where('reporting_manager_id', $actor->id))
            ->orWhereHas('assignee', fn (Builder $user) => DataScope::apply($user, $actor)));
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNotIn('status', self::CLOSED_STATUSES);
    }

    public function scopeOverdue(Builder $query): Builder
    {
        return $query->open()->whereNotNull('due_date')->whereDate('due_date', '<', Carbon::today());
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->visibleTo(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class);
    }

    public function isClosed(): bool
    {
        return in_array($this->status, self::CLOSED_STATUSES, true);
    }

    public function isOverdue(): bool
    {
        return ! $this->isClosed() && $this->due_date !== null && $this->due_date->isBefore(Carbon::today());
    }

    public function daysLeft(): ?int
    {
        return $this->due_date === null
            ? null
            : (int) round(Carbon::today()->diffInDays($this->due_date, false));
    }

    public function isOwnedBy(User $actor): bool
    {
        return (int) $this->assignee_id === (int) $actor->id
            || (int) $this->assigned_by === (int) $actor->id;
    }
}

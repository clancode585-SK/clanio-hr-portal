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
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PerformanceGoal extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    /** Employee ne likha, manager ne approve nahi kiya */
    public const DRAFT = 'draft';

    /** Manager ne approve kiya — ab count hoga */
    public const ACTIVE = 'active';

    public const ACHIEVED = 'achieved';

    public const MISSED = 'missed';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [
        self::DRAFT,
        self::ACTIVE,
        self::ACHIEVED,
        self::MISSED,
        self::CANCELLED,
    ];

    /** Standalone target — apna weight, apna progress */
    public const TYPE_KRA = 'kra';

    /** OKR ka Objective — khud ka target nahi, progress key results se banta hai */
    public const TYPE_OBJECTIVE = 'objective';

    /** Objective ke andar ka measurable Key Result */
    public const TYPE_KEY_RESULT = 'key_result';

    public const GOAL_TYPES = [self::TYPE_KRA, self::TYPE_OBJECTIVE, self::TYPE_KEY_RESULT];

    /** Progress employee khud update karega */
    public const SOURCE_MANUAL = 'manual';

    /** Progress linked tasks ke done % se apne aap banega */
    public const SOURCE_TASKS = 'tasks';

    public const SOURCES = [self::SOURCE_MANUAL, self::SOURCE_TASKS];

    protected $fillable = [
        'appraisal_cycle_id',
        'parent_id',
        'goal_type',
        'title',
        'description',
        'metric',
        'target_value',
        'achieved_value',
        'weight',
        'start_date',
        'due_date',
        'progress_source',
    ];

    protected $attributes = [
        'progress_source' => self::SOURCE_MANUAL,
        'progress_percent' => 0,
        'status' => self::DRAFT,
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'target_value' => 'float',
            'achieved_value' => 'float',
            'weight' => 'integer',
            'progress_percent' => 'integer',
            'approved_at' => 'datetime',
            'closed_at' => 'datetime',
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

        return $query->whereHas('employee', fn (Builder $employee) => $employee
            ->where('reporting_manager_id', $actor->id)
            ->orWhere('user_id', $actor->id));
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

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function tasks(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'performance_goal_tasks', 'performance_goal_id', 'task_id')
            ->withTimestamps();
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function keyResults(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function isObjective(): bool
    {
        return $this->goal_type === self::TYPE_OBJECTIVE;
    }

    public function isKeyResult(): bool
    {
        return $this->goal_type === self::TYPE_KEY_RESULT;
    }

    public function isDraft(): bool
    {
        return $this->status === self::DRAFT;
    }

    public function isActive(): bool
    {
        return $this->status === self::ACTIVE;
    }

    public function isClosed(): bool
    {
        return in_array($this->status, [self::ACHIEVED, self::MISSED, self::CANCELLED], true);
    }

    public function tracksTasks(): bool
    {
        return $this->progress_source === self::SOURCE_TASKS;
    }
}

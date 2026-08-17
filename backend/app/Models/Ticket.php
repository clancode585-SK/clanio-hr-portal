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
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Ticket extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const NUMBER_PREFIX = 'TKT';

    public const VIEW_ALL_PERMISSION = 'ticket.view_all';

    public const ASSIGN_PERMISSION = 'ticket.assign';

    public const RESOLVE_PERMISSION = 'ticket.resolve';

    public const CATEGORY_PERMISSION = 'ticket.category_manage';

    public const PLATFORM_PERMISSION = 'ticket.platform';

    public const OPEN = 'open';

    public const IN_PROGRESS = 'in_progress';

    public const WAITING_ON_USER = 'waiting_on_user';

    public const RESOLVED = 'resolved';

    public const CLOSED = 'closed';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [
        self::OPEN,
        self::IN_PROGRESS,
        self::WAITING_ON_USER,
        self::RESOLVED,
        self::CLOSED,
        self::CANCELLED,
    ];

    public const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

    public const REOPEN_WINDOW_DAYS = 7;

    protected $fillable = [
        'subject',
        'message',
        'priority',
    ];

    protected $attributes = [
        'scope' => TicketCategory::SCOPE_INTERNAL,
        'priority' => 'medium',
        'status' => self::OPEN,
        'paused_minutes' => 0,
        'reopen_count' => 0,
    ];

    protected $hidden = ['number_key'];

    protected function casts(): array
    {
        return [
            'first_response_due_at' => 'datetime',
            'resolution_due_at' => 'datetime',
            'first_responded_at' => 'datetime',
            'waiting_since' => 'datetime',
            'escalated_at' => 'datetime',
            'resolved_at' => 'datetime',
            'closed_at' => 'datetime',
            'reopened_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'paused_minutes' => 'integer',
            'reopen_count' => 'integer',
            'response_breached' => 'boolean',
            'resolution_breached' => 'boolean',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['number_key', 'created_at', 'updated_at'];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null) {
            return $query;
        }

        if ($actor->isSuperAdmin()) {
            return $query->where('scope', TicketCategory::SCOPE_PLATFORM);
        }

        if ($actor->hasPermission(self::VIEW_ALL_PERMISSION) || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        return $query->where(fn (Builder $inner) => $inner
            ->where('raised_by', $actor->id)
            ->orWhere('assigned_to', $actor->id)
            ->when(
                $actor->department_id !== null,
                fn (Builder $dept) => $dept->orWhere('assigned_department_id', $actor->department_id)
            ));
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->visibleTo(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TicketCategory::class, 'category_id');
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(TicketCategoryRoute::class, 'route_id');
    }

    public function raiser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'raised_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'assigned_department_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TicketComment::class)->orderBy('id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class);
    }

    public function isRaiser(User $actor): bool
    {
        return (int) $this->raised_by === (int) $actor->id;
    }

    public function isAssignee(User $actor): bool
    {
        return $this->assigned_to !== null && (int) $this->assigned_to === (int) $actor->id;
    }

    public function isPlatform(): bool
    {
        return $this->scope === TicketCategory::SCOPE_PLATFORM;
    }

    public function isOpenStage(): bool
    {
        return in_array($this->status, [self::OPEN, self::IN_PROGRESS, self::WAITING_ON_USER], true);
    }

    public function isFinished(): bool
    {
        return in_array($this->status, [self::CLOSED, self::CANCELLED], true);
    }

    public function isWaiting(): bool
    {
        return $this->status === self::WAITING_ON_USER;
    }

    public function canReopen(): bool
    {
        if ($this->status !== self::RESOLVED || $this->resolved_at === null) {
            return false;
        }

        return $this->resolved_at->addDays(self::REOPEN_WINDOW_DAYS)->isFuture();
    }

    public function minutesLeft(): ?int
    {
        if ($this->resolution_due_at === null || ! $this->isOpenStage() || $this->isWaiting()) {
            return null;
        }

        return (int) Carbon::now()->diffInMinutes($this->resolution_due_at, false);
    }

    public function hasTarget(): bool
    {
        return $this->resolution_due_at !== null;
    }

    public function slaState(): string
    {
        if (! $this->hasTarget()) {
            return 'no_target';
        }

        if ($this->isWaiting()) {
            return 'paused';
        }

        $left = $this->minutesLeft();

        if ($left === null) {
            return 'na';
        }

        if ($left < 0) {
            return 'breached';
        }

        return $left <= 240 ? 'due_soon' : 'on_track';
    }

    public function stageLabel(): string
    {
        return match ($this->status) {
            self::OPEN => 'Abhi kisi ne uthaya nahi',
            self::IN_PROGRESS => 'Kaam chal raha hai',
            self::WAITING_ON_USER => 'Aapke jawab ka intezaar hai',
            self::RESOLVED => 'Solve ho gaya — confirm karna baaki hai',
            self::CLOSED => 'Band',
            self::CANCELLED => 'Cancel',
            default => $this->status,
        };
    }
}

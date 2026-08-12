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

class AssetRequest extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const TYPE_NEW = 'new';

    public const TYPE_REPAIR = 'repair';

    public const TYPE_REPLACEMENT = 'replacement';

    public const TYPE_RETURN = 'return';

    public const TYPES = [
        self::TYPE_NEW => 'Naya asset chahiye',
        self::TYPE_REPAIR => 'Issue hai — repair karwana hai',
        self::TYPE_REPLACEMENT => 'Theek nahi ho raha — badal do',
        self::TYPE_RETURN => 'Zarurat nahi — wapas le lo',
    ];

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const IN_PROGRESS = 'in_progress';

    public const RESOLVED = 'resolved';

    public const REJECTED = 'rejected';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [
        self::PENDING,
        self::APPROVED,
        self::IN_PROGRESS,
        self::RESOLVED,
        self::REJECTED,
        self::CANCELLED,
    ];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    protected $fillable = [
        'request_type',
        'category',
        'title',
        'description',
        'priority',
    ];

    protected $attributes = [
        'priority' => 'normal',
        'status' => self::PENDING,
    ];

    protected $hidden = ['is_open'];

    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
            'started_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['is_open', 'created_at', 'updated_at'];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        if ($actor->hasPermission(Asset::SUPPORT_PERMISSION) || $actor->hasPermission(Asset::MANAGE_PERMISSION)) {
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

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handler_id');
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::APPROVED;
    }

    public function isInProgress(): bool
    {
        return $this->status === self::IN_PROGRESS;
    }

    public function isClosed(): bool
    {
        return in_array($this->status, [self::RESOLVED, self::REJECTED, self::CANCELLED], true);
    }

    public function needsAsset(): bool
    {
        return in_array($this->request_type, [self::TYPE_REPAIR, self::TYPE_REPLACEMENT, self::TYPE_RETURN], true);
    }

    public function typeLabel(): string
    {
        return self::TYPES[$this->request_type] ?? $this->request_type;
    }

    public function stageLabel(): string
    {
        return match ($this->status) {
            self::PENDING => 'IT ke paas hai',
            self::APPROVED => 'Approve ho gaya — kaam shuru hona hai',
            self::IN_PROGRESS => 'Kaam chal raha hai',
            self::RESOLVED => 'Ho gaya',
            self::REJECTED => 'Reject',
            self::CANCELLED => 'Cancel',
            default => $this->status,
        };
    }
}

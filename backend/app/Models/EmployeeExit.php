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

class EmployeeExit extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    /** Employee ne resignation daali — manager ke paas hai */
    public const PENDING = 'pending';

    /** Manager ne approve kiya — HR final approval degi */
    public const MANAGER_APPROVED = 'manager_approved';

    /** HR ne last working date set kar di — notice chal raha hai */
    public const SERVING_NOTICE = 'serving_notice';

    /** Last working date nikal gayi — login band ho chuka hai */
    public const EXITED = 'exited';

    public const REJECTED = 'rejected';

    public const WITHDRAWN = 'withdrawn';

    public const STATUSES = [
        self::PENDING,
        self::MANAGER_APPROVED,
        self::SERVING_NOTICE,
        self::EXITED,
        self::REJECTED,
        self::WITHDRAWN,
    ];

    public const TYPE_RESIGNATION = 'resignation';

    public const TYPE_TERMINATION = 'termination';

    public const TYPE_RETIREMENT = 'retirement';

    public const TYPE_ABSCONDING = 'absconding';

    public const EXIT_TYPES = [
        self::TYPE_RESIGNATION => 'Resignation — employee ne khud di',
        self::TYPE_TERMINATION => 'Termination — company ne nikala',
        self::TYPE_RETIREMENT => 'Retirement',
        self::TYPE_ABSCONDING => 'Absconding — bina bataye chala gaya',
    ];

    public const STAGE_MANAGER = 'manager';

    public const STAGE_HR = 'hr';

    public const APPROVE_PERMISSION = 'exit.approve';

    public const DOCUMENT_PERMISSION = 'exit.document';

    public const DEFAULT_NOTICE_DAYS = 30;

    protected $fillable = [
        'exit_type',
        'resignation_date',
        'requested_last_working_date',
        'reason',
    ];

    protected $attributes = [
        'exit_type' => self::TYPE_RESIGNATION,
        'status' => self::PENDING,
    ];

    protected $hidden = ['open_key'];

    protected function casts(): array
    {
        return [
            'resignation_date' => 'date:Y-m-d',
            'requested_last_working_date' => 'date:Y-m-d',
            'last_working_date' => 'date:Y-m-d',
            'notice_period_days' => 'integer',
            'manager_decided_at' => 'datetime',
            'hr_decided_at' => 'datetime',
            'rejected_at' => 'datetime',
            'withdrawn_at' => 'datetime',
            'exited_at' => 'datetime',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['open_key', 'created_at', 'updated_at'];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        if ($actor->hasPermission(self::APPROVE_PERMISSION)) {
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

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function hr(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hr_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ExitDocument::class);
    }

    public function clearances(): HasMany
    {
        return $this->hasMany(ExitClearance::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isManagerApproved(): bool
    {
        return $this->status === self::MANAGER_APPROVED;
    }

    public function isServingNotice(): bool
    {
        return $this->status === self::SERVING_NOTICE;
    }

    public function isExited(): bool
    {
        return $this->status === self::EXITED;
    }

    public function isClosed(): bool
    {
        return in_array($this->status, [self::EXITED, self::REJECTED, self::WITHDRAWN], true);
    }

    public function stageLabel(): string
    {
        return match ($this->status) {
            self::PENDING => 'Manager ke paas',
            self::MANAGER_APPROVED => 'HR final approval ke paas',
            self::SERVING_NOTICE => 'Notice period chal raha hai',
            self::EXITED => 'Exit ho chuka hai',
            self::REJECTED => 'Rejected',
            self::WITHDRAWN => 'Employee ne wapas le li',
            default => $this->status,
        };
    }

    public function typeLabel(): string
    {
        return self::EXIT_TYPES[$this->exit_type] ?? $this->exit_type;
    }
}

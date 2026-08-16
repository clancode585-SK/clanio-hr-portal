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

class AttendanceRegularization extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [self::PENDING, self::APPROVED, self::REJECTED, self::CANCELLED];

    public const MISSING_PUNCH = 'missing_punch';

    public const MISSING_CHECKOUT = 'missing_checkout';

    public const SHORT_HOURS = 'short_hours';

    public const WRONG_TIME = 'wrong_time';

    public const TYPES = [self::MISSING_PUNCH, self::MISSING_CHECKOUT, self::SHORT_HOURS, self::WRONG_TIME];

    public const TYPE_LABELS = [
        self::MISSING_PUNCH => 'Punch hi nahi laga',
        self::MISSING_CHECKOUT => 'Check-in hai, check-out nahi',
        self::SHORT_HOURS => 'Ghante kam hain',
        self::WRONG_TIME => 'Time galat laga tha',
    ];

    public const APPROVE_PERMISSION = 'attendance.regularize';

    public const DEFAULT_WINDOW_DAYS = 7;

    protected $fillable = [
        'attendance_date',
        'requested_check_in',
        'requested_check_out',
        'reason',
    ];

    protected $attributes = [
        'status' => self::PENDING,
    ];

    protected $hidden = ['day_key'];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date:Y-m-d',
            'requested_check_in' => 'datetime',
            'requested_check_out' => 'datetime',
            'previous_check_in' => 'datetime',
            'previous_check_out' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['day_key', 'created_at', 'updated_at'];
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
            ->orWhere('user_id', $actor->id)
            ->orWhereHas('user', fn (Builder $user) => DataScope::apply($user, $actor)));
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

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function attendance(): BelongsTo
    {
        return $this->belongsTo(Attendance::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function typeLabel(): string
    {
        return self::TYPE_LABELS[$this->type] ?? $this->type;
    }
}

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

class LeaveRequest extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const CANCELLED = 'cancelled';

    public const FIRST_HALF = 'first_half';

    public const SECOND_HALF = 'second_half';

    public const SESSIONS = [self::FIRST_HALF, self::SECOND_HALF];

    protected $fillable = [
        'from_date',
        'to_date',
        'is_half_day',
        'half_day_session',
        'reason',
        'contact_number',
        'document_id',
    ];

    protected $attributes = [
        'status' => self::PENDING,
        'is_half_day' => false,
        'day_count' => 0,
    ];

    protected function casts(): array
    {
        return [
            'from_date' => 'date:Y-m-d',
            'to_date' => 'date:Y-m-d',
            'day_count' => 'float',
            'is_half_day' => 'boolean',
            'decided_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
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

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(EmployeeDocument::class, 'document_id');
    }

    public function days(): HasMany
    {
        return $this->hasMany(LeaveRequestDay::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::APPROVED;
    }
}

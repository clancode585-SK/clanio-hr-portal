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

class IncentiveRecord extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    /** Nikal liya, par abhi kisi ne dekha nahi */
    public const CALCULATED = 'calculated';

    /** HR/admin ne approve kar diya — payroll ab isse utha sakta hai */
    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const STATUSES = [self::CALCULATED, self::APPROVED, self::REJECTED];

    protected $fillable = ['remarks'];

    protected $attributes = ['status' => self::CALCULATED];

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'goal_count' => 'integer',
            'achievement_percent' => 'integer',
            'base_percent' => 'float',
            'payout_factor' => 'integer',
            'incentive_percent' => 'float',
            'calculated_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        if ($actor->hasPermission(IncentiveRule::APPROVE_PERMISSION)) {
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

    public function rule(): BelongsTo
    {
        return $this->belongsTo(IncentiveRule::class, 'incentive_rule_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isCalculated(): bool
    {
        return $this->status === self::CALCULATED;
    }

    public function isApproved(): bool
    {
        return $this->status === self::APPROVED;
    }
}

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

class LeaveBalance extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;

    protected $fillable = [
        'year',
        'opening',
        'accrued',
        'used',
        'encashed',
        'adjusted',
    ];

    protected $attributes = [
        'opening' => 0,
        'accrued' => 0,
        'used' => 0,
        'encashed' => 0,
        'adjusted' => 0,
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'opening' => 'float',
            'accrued' => 'float',
            'used' => 'float',
            'encashed' => 'float',
            'adjusted' => 'float',
            'available' => 'float',
        ];
    }

    protected function auditSensitive(): array
    {
        return ['available'];
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
}

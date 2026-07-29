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
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Attendance extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    public const PRESENT = 'present';

    public const HALF_DAY = 'half_day';

    public const ABSENT = 'absent';

    protected $fillable = [
        'attendance_date',
        'status',
        'source',
    ];

    protected $attributes = [
        'status' => self::PRESENT,
        'source' => 'self',
        'worked_minutes' => 0,
        'break_minutes' => 0,
        'punch_count' => 0,
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date:Y-m-d',
            'first_check_in_at' => 'datetime',
            'last_check_out_at' => 'datetime',
            'worked_minutes' => 'integer',
            'break_minutes' => 'integer',
            'punch_count' => 'integer',
            'is_late' => 'boolean',
            'late_minutes' => 'integer',
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

    public function workShift(): BelongsTo
    {
        return $this->belongsTo(WorkShift::class);
    }

    public function details(): HasMany
    {
        return $this->hasMany(AttendanceDetail::class);
    }

    public function openDetail(): HasOne
    {
        return $this->hasOne(AttendanceDetail::class)->whereNull('check_out_at');
    }

    public static function humanDuration(int $minutes): string
    {
        return intdiv($minutes, 60) . ' h ' . ($minutes % 60) . ' min';
    }
}

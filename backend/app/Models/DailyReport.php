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

class DailyReport extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;

    public const PENDING = 'pending';

    public const SOD_DONE = 'sod_done';

    public const EOD_ONLY = 'eod_only';

    public const COMPLETED = 'completed';

    public const STATUSES = [self::PENDING, self::SOD_DONE, self::EOD_ONLY, self::COMPLETED];

    public const BACKFILL_DAYS = 1;

    public const TEAM_PERMISSION = 'daily_report.view_team';

    protected $fillable = [
        'sod_plan',
        'eod_summary',
        'eod_blockers',
        'eod_tomorrow_plan',
        'worked_hours',
    ];

    protected function casts(): array
    {
        return [
            'report_date' => 'date:Y-m-d',
            'worked_hours' => 'float',
            'sod_submitted_at' => 'datetime',
            'eod_submitted_at' => 'datetime',
            'is_sod_late' => 'boolean',
            'is_eod_late' => 'boolean',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['status', 'created_at', 'updated_at'];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        if ($actor->hasPermission(self::TEAM_PERMISSION)) {
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

    public function items(): HasMany
    {
        return $this->hasMany(DailyReportItem::class);
    }

    public function sodItems(): HasMany
    {
        return $this->items()->where('section', DailyReportItem::SOD)->orderBy('sort_order');
    }

    public function eodItems(): HasMany
    {
        return $this->items()->where('section', DailyReportItem::EOD)->orderBy('sort_order');
    }

    public function hasSod(): bool
    {
        return $this->sod_submitted_at !== null;
    }

    public function hasEod(): bool
    {
        return $this->eod_submitted_at !== null;
    }
}

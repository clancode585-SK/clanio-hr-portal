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

class SalaryStructure extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const ACTIVE = 'active';

    public const SUPERSEDED = 'superseded';

    public const STATUSES = [self::ACTIVE, self::SUPERSEDED];

    public const VIEW_PERMISSION = 'salary_structure.view';

    public const MANAGE_PERMISSION = 'salary_structure.manage';

    protected $fillable = [
        'effective_from',
        'effective_to',
        'annual_ctc',
        'revision_reason',
    ];

    protected $attributes = [
        'status' => self::ACTIVE,
        'annual_ctc' => 0,
        'monthly_gross' => 0,
        'monthly_net' => 0,
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date:Y-m-d',
            'effective_to' => 'date:Y-m-d',
            'annual_ctc' => 'float',
            'monthly_gross' => 'float',
            'monthly_net' => 'float',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SalaryStructureLine::class, 'structure_id')->orderBy('sequence')->orderBy('id');
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        return $query->whereHas('employee.user', fn (Builder $inner) => DataScope::apply($inner, $actor));
    }

    public function scopeEffectiveOn(Builder $query, string $date): Builder
    {
        return $query->where('effective_from', '<=', $date)
            ->where(fn (Builder $inner) => $inner->whereNull('effective_to')->orWhere('effective_to', '>=', $date));
    }

    public function isCurrent(): bool
    {
        return $this->status === self::ACTIVE && $this->effective_to === null;
    }

    public function earnings(): float
    {
        return round($this->lines->where('kind', SalaryComponent::EARNING)->sum('monthly_amount'), 2);
    }

    public function deductions(): float
    {
        return round($this->lines->where('kind', SalaryComponent::DEDUCTION)->sum('monthly_amount'), 2);
    }

    public function employerCost(): float
    {
        return round($this->lines->where('kind', SalaryComponent::EMPLOYER_COST)->sum('monthly_amount'), 2);
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->visibleTo(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }
}

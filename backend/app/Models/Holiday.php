<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Holiday extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    public const PUBLIC = 'public';

    public const OPTIONAL = 'optional';

    public const RESTRICTED = 'restricted';

    protected $fillable = [
        'name',
        'holiday_date',
        'branch_id',
        'type',
        'is_paid',
        'description',
    ];

    protected $attributes = [
        'type' => self::PUBLIC,
        'is_paid' => true,
    ];

    protected function casts(): array
    {
        return [
            'holiday_date' => 'date:Y-m-d',
            'is_paid' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function scopeForBranch(Builder $query, ?int $branchId): Builder
    {
        return $query->where(fn (Builder $inner) => $inner
            ->whereNull('branch_id')
            ->when($branchId !== null, fn (Builder $branch) => $branch->orWhere('branch_id', $branchId)));
    }

    public function blocksAttendance(): bool
    {
        return $this->type === self::PUBLIC;
    }
}

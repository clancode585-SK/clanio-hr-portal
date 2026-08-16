<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IncentiveRule extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const MANAGE_PERMISSION = 'incentive.manage';

    public const APPROVE_PERMISSION = 'incentive.approve';

    protected $fillable = [
        'name',
        'role_id',
        'base_percent',
        'period_type',
        'description',
    ];

    protected $attributes = [
        'base_percent' => 0,
        'period_type' => 'month',
    ];

    protected $hidden = ['rule_key'];

    protected function casts(): array
    {
        return ['base_percent' => 'float'];
    }

    protected function auditExcluded(): array
    {
        return ['rule_key', 'created_at', 'updated_at'];
    }

    public function slabs(): HasMany
    {
        return $this->hasMany(IncentiveSlab::class)->orderBy('from_percent');
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /** Achievement % kis slab me girta hai — wahi payout factor dega. */
    public function slabFor(int $achievement): ?IncentiveSlab
    {
        return $this->slabs
            ->first(fn (IncentiveSlab $slab): bool => $achievement >= $slab->from_percent
                && $achievement <= $slab->to_percent);
    }
}

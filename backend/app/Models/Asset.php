<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Model;

class Asset extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const AVAILABLE = 'available';

    public const ALLOCATED = 'allocated';

    public const IN_REPAIR = 'in_repair';

    public const LOST = 'lost';

    public const RETIRED = 'retired';

    public const STATUSES = [self::AVAILABLE, self::ALLOCATED, self::IN_REPAIR, self::LOST, self::RETIRED];

    public const NEW = 'new';

    public const GOOD = 'good';

    public const FAIR = 'fair';

    public const DAMAGED = 'damaged';

    public const CONDITIONS = [self::NEW, self::GOOD, self::FAIR, self::DAMAGED];

    public const CATEGORIES = [
        'laptop' => 'Laptop',
        'desktop' => 'Desktop',
        'monitor' => 'Monitor',
        'mobile' => 'Mobile',
        'sim' => 'SIM card',
        'headset' => 'Headset',
        'keyboard' => 'Keyboard / Mouse',
        'id_card' => 'ID card',
        'access_card' => 'Access card',
        'other' => 'Other',
    ];

    public const MANAGE_PERMISSION = 'asset.manage';

    public const SUPPORT_PERMISSION = 'asset.support';

    public const CODE_PREFIX = 'AST';

    protected $fillable = [
        'category',
        'name',
        'brand',
        'model',
        'serial_number',
        'purchase_date',
        'purchase_cost',
        'warranty_expiry',
        'condition_state',
        'notes',
    ];

    protected $attributes = [
        'condition_state' => self::GOOD,
        'status' => self::AVAILABLE,
    ];

    protected $hidden = ['code_key', 'serial_key'];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date:Y-m-d',
            'warranty_expiry' => 'date:Y-m-d',
            'purchase_cost' => 'float',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['code_key', 'serial_key', 'created_at', 'updated_at'];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(AssetAllocation::class);
    }

    public function currentAllocation(): HasOne
    {
        return $this->hasOne(AssetAllocation::class)->where('status', AssetAllocation::ALLOCATED);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(AssetRequest::class);
    }

    public function isAvailable(): bool
    {
        return $this->status === self::AVAILABLE;
    }

    public function isAllocated(): bool
    {
        return $this->status === self::ALLOCATED;
    }

    public function isRetired(): bool
    {
        return in_array($this->status, [self::RETIRED, self::LOST], true);
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? $this->category;
    }

    public function label(): string
    {
        return $this->asset_code . ' — ' . $this->name;
    }
}

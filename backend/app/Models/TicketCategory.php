<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TicketCategory extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const SCOPE_INTERNAL = 'internal';

    public const SCOPE_PLATFORM = 'platform';

    public const SCOPES = [self::SCOPE_INTERNAL, self::SCOPE_PLATFORM];

    protected $fillable = [
        'name',
        'code',
        'scope',
        'default_priority',
        'support_email',
        'response_hours',
        'resolution_hours',
        'sort_order',
        'is_active',
    ];

    protected $attributes = [
        'scope' => self::SCOPE_INTERNAL,
        'default_priority' => 'medium',
        'sort_order' => 0,
        'is_system' => false,
        'is_active' => true,
    ];

    protected $hidden = ['code_key'];

    protected function casts(): array
    {
        return [
            'response_hours' => 'integer',
            'resolution_hours' => 'integer',
            'sort_order' => 'integer',
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['code_key', 'created_at', 'updated_at'];
    }

    public function routes(): HasMany
    {
        return $this->hasMany(TicketCategoryRoute::class, 'category_id')->orderBy('sort_order');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'category_id');
    }

    public function isPlatform(): bool
    {
        return $this->scope === self::SCOPE_PLATFORM;
    }
}

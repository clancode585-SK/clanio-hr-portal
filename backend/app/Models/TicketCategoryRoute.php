<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketCategoryRoute extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const TO_DEPARTMENT = 'department';

    public const TO_MANAGER = 'manager';

    public const TO_USER = 'user';

    public const TO_SUPER_ADMIN = 'super_admin';

    public const TARGETS = [self::TO_DEPARTMENT, self::TO_MANAGER, self::TO_USER, self::TO_SUPER_ADMIN];

    protected $fillable = [
        'route_to',
        'department_id',
        'user_id',
        'label',
        'hint',
        'is_default',
        'sort_order',
        'is_active',
    ];

    protected $attributes = [
        'route_to' => self::TO_DEPARTMENT,
        'is_default' => false,
        'sort_order' => 0,
        'is_active' => true,
    ];

    protected $hidden = ['default_key'];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['default_key', 'created_at', 'updated_at'];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TicketCategory::class, 'category_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

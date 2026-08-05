<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const COMPANY_ADMIN = 'company_admin';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'hierarchy_level',
        'data_scope',
        'is_active',
    ];

    protected $attributes = [
        'hierarchy_level' => 99,
        'data_scope' => 'self',
        'is_system' => false,
        'is_active' => true,
    ];

    protected $hidden = ['company_key'];

    protected function casts(): array
    {
        return [
            'hierarchy_level' => 'integer',
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permissions')->withTimestamps();
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_roles');
    }
}

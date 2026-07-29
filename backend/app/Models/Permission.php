<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['module', 'action', 'slug', 'name', 'group_name', 'description'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_permissions');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}

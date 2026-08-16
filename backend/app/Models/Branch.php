<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'address',
        'phone',
        'email',
        'is_head_office',
        'status',
    ];

    protected $attributes = [
        'status' => 'active',
        'is_head_office' => false,
    ];

    protected function casts(): array
    {
        return ['is_head_office' => 'boolean'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function resolveRouteBinding($value, $field = null)
    {
        $query = $this->newQuery();
        if (auth()->user()?->isSuperAdmin() && app(\App\Support\TenantContext::class)->id() === null) {
            $query = static::withoutGlobalScopes();
        }

        return $this->resolveRouteBindingQuery($query, $value, $field)->firstOrFail();
    }
}

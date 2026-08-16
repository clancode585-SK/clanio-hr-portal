<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'description',
        'branch_id',
        'status',
    ];

    protected $attributes = [
        'status' => 'active',
    ];

    public function resolveRouteBinding($value, $field = null)
    {
        $query = $this->newQuery()->withoutGlobalScopes();
        $user = auth()->user();
        if ($user && ! $user->isSuperAdmin() && $user->company_id !== null) {
            $query->where('company_id', $user->company_id);
        }

        if (is_numeric($value)) {
            return $query->where('id', (int) $value)->firstOrFail();
        }

        return $query->where(function ($q) use ($value) {
            $q->where('uuid', $value)->orWhere('code', $value);
        })->firstOrFail();
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}

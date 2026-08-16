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

class Designation extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'level',
        'description',
        'department_id',
        'status',
    ];

    protected $attributes = [
        'status' => 'active',
        'level' => 1,
    ];

    protected function casts(): array
    {
        return ['level' => 'integer'];
    }

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

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }
}

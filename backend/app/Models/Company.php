<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use Auditable;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'legal_name',
        'slug',
        'email',
        'phone',
        'website',
        'address',
        'city',
        'state',
        'country',
        'pincode',
        'gstin',
        'pan_number',
        'tan_number',
        'cin_number',
        'logo_url',
        'industry',
        'max_employees',
        'timezone',
        'currency',
        'fiscal_year_start',
        'status',
    ];

    protected $attributes = [
        'status' => 'active',
        'employee_count' => 0,
        'country' => 'India',
        'timezone' => 'Asia/Kolkata',
        'currency' => 'INR',
        'fiscal_year_start' => 4,
    ];

    protected function casts(): array
    {
        return [
            'employee_count' => 'integer',
            'max_employees' => 'integer',
            'fiscal_year_start' => 'integer',
        ];
    }

    public function resolveRouteBinding($value, $field = null)
    {
        if (is_numeric($value)) {
            return $this->newQuery()->where('id', (int) $value)->firstOrFail();
        }

        return $this->newQuery()->where(function ($q) use ($value) {
            $q->where('uuid', $value)->orWhere('slug', $value);
        })->firstOrFail();
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }
}

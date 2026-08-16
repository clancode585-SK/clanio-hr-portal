<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    protected $fillable = [
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
}

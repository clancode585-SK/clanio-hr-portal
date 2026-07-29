<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeFamilyMember extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    public const RELATIONS = ['father', 'mother', 'spouse', 'son', 'daughter', 'brother', 'sister', 'other'];

    protected $fillable = [
        'name',
        'relation',
        'date_of_birth',
        'occupation',
        'phone',
        'is_dependent',
        'is_nominee',
        'nominee_share',
    ];

    protected $attributes = [
        'is_dependent' => false,
        'is_nominee' => false,
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date:Y-m-d',
            'is_dependent' => 'boolean',
            'is_nominee' => 'boolean',
            'nominee_share' => 'float',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}

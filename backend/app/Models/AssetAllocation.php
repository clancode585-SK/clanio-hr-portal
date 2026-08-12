<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetAllocation extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const ALLOCATED = 'allocated';

    public const RETURNED = 'returned';

    public const STATUSES = [self::ALLOCATED, self::RETURNED];

    protected $fillable = [
        'allocated_on',
        'expected_return_date',
        'allocation_condition',
        'allocation_remarks',
    ];

    protected $attributes = [
        'status' => self::ALLOCATED,
        'allocation_condition' => Asset::GOOD,
        'recoverable_amount' => 0,
    ];

    protected $hidden = ['open_key'];

    protected function casts(): array
    {
        return [
            'allocated_on' => 'date:Y-m-d',
            'expected_return_date' => 'date:Y-m-d',
            'returned_on' => 'date:Y-m-d',
            'recoverable_amount' => 'float',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['open_key', 'created_at', 'updated_at'];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function allocator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'allocated_by');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function isOpen(): bool
    {
        return $this->status === self::ALLOCATED;
    }
}

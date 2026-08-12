<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PolicyAcknowledgement extends Model
{
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const PENDING = 'pending';

    public const ACKNOWLEDGED = 'acknowledged';

    public const STATUSES = [self::PENDING, self::ACKNOWLEDGED];

    protected $fillable = ['note'];

    protected $attributes = ['status' => self::PENDING];

    protected function casts(): array
    {
        return [
            'due_on' => 'date:Y-m-d',
            'acknowledged_at' => 'datetime',
        ];
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(Policy::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isOverdue(): bool
    {
        return $this->isPending() && $this->due_on !== null && $this->due_on->isPast();
    }
}

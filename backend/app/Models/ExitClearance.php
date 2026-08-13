<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExitClearance extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const PENDING = 'pending';

    public const CLEARED = 'cleared';

    public const BLOCKED = 'blocked';

    public const NOT_APPLICABLE = 'not_applicable';

    public const STATUSES = [self::PENDING, self::CLEARED, self::BLOCKED, self::NOT_APPLICABLE];

    public const SOURCE_CHECKLIST = 'checklist';

    public const SOURCE_ASSET = 'asset';

    public const SOURCE_POLICY = 'policy';

    protected $fillable = [
        'status',
        'remarks',
        'recoverable_amount',
    ];

    protected $attributes = [
        'status' => self::PENDING,
        'recoverable_amount' => 0,
    ];

    protected $hidden = ['is_open'];

    protected function casts(): array
    {
        return [
            'is_recoverable' => 'boolean',
            'is_mandatory' => 'boolean',
            'recoverable_amount' => 'float',
            'cleared_at' => 'datetime',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['is_open', 'created_at', 'updated_at'];
    }

    public function exit(): BelongsTo
    {
        return $this->belongsTo(EmployeeExit::class, 'employee_exit_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(ClearanceItem::class, 'clearance_item_id');
    }

    public function clearedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cleared_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isCleared(): bool
    {
        return $this->status === self::CLEARED;
    }

    public function blocksExit(): bool
    {
        return (bool) $this->is_mandatory && in_array($this->status, [self::PENDING, self::BLOCKED], true);
    }

    public function departmentLabel(): string
    {
        return ClearanceItem::DEPARTMENTS[$this->department] ?? $this->department;
    }
}

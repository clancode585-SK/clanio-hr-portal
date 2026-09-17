<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const DRAFT = 'draft';

    public const CALCULATED = 'calculated';

    public const APPROVED = 'approved';

    public const PAID = 'paid';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [self::DRAFT, self::CALCULATED, self::APPROVED, self::PAID, self::CANCELLED];

    public const VIEW_PERMISSION = 'payroll.view';

    public const RUN_PERMISSION = 'payroll.run';

    public const APPROVE_PERMISSION = 'payroll.approve';

    protected $fillable = [
        'month',
        'pay_date',
        'note',
    ];

    protected $attributes = [
        'status' => self::DRAFT,
        'headcount' => 0,
        'approved_count' => 0,
        'stopped_count' => 0,
        'working_days' => 0,
        'total_earnings' => 0,
        'total_deductions' => 0,
        'total_net' => 0,
        'total_employer' => 0,
        'paid_count' => 0,
        'paid_amount' => 0,
    ];

    protected function casts(): array
    {
        return [
            'pay_date' => 'date:Y-m-d',
            'working_days' => 'float',
            'total_earnings' => 'float',
            'total_deductions' => 'float',
            'total_net' => 'float',
            'total_employer' => 'float',
            'paid_amount' => 'float',
            'headcount' => 'integer',
            'paid_count' => 'integer',
            'approved_count' => 'integer',
            'stopped_count' => 'integer',
            'calculated_at' => 'datetime',
            'approved_at' => 'datetime',
            'transfer_scheduled_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PayrollItem::class, 'run_id');
    }

    public function calculatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'calculated_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isDraft(): bool
    {
        return $this->status === self::DRAFT;
    }

    public function isCalculated(): bool
    {
        return $this->status === self::CALCULATED;
    }

    public function isApproved(): bool
    {
        return $this->status === self::APPROVED;
    }

    public function isPaid(): bool
    {
        return $this->status === self::PAID;
    }

    public function isCancelled(): bool
    {
        return $this->status === self::CANCELLED;
    }

    public function isEditable(): bool
    {
        return in_array($this->status, [self::DRAFT, self::CALCULATED], true);
    }

    public function isPayable(): bool
    {
        return in_array($this->status, [self::APPROVED, self::PAID], true);
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::DRAFT => 'Draft',
            self::CALCULATED => 'Calculated',
            self::APPROVED => 'Approved, ready to pay',
            self::PAID => 'Paid',
            self::CANCELLED => 'Cancelled',
            default => $this->status,
        };
    }

    public function monthLabel(): string
    {
        return \Illuminate\Support\Carbon::parse($this->month . '-01')->format('F Y');
    }
}

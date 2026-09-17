<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use App\Support\DataScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FnfSettlement extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const DRAFT = 'draft';

    public const CALCULATED = 'calculated';

    public const APPROVED = 'approved';

    public const SETTLED = 'settled';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [self::DRAFT, self::CALCULATED, self::APPROVED, self::SETTLED, self::CANCELLED];

    public const PENDING = 'pending';

    public const PROCESSING = 'processing';

    public const PAID = 'paid';

    public const FAILED = 'failed';

    public const ON_HOLD = 'on_hold';

    public const RECOVERABLE = 'recoverable';

    public const VIEW_PERMISSION = 'fnf.view';

    public const MANAGE_PERMISSION = 'fnf.manage';

    public const APPROVE_PERMISSION = 'fnf.approve';

    protected $fillable = [
        'note',
    ];

    protected $attributes = [
        'status' => self::DRAFT,
        'payment_status' => self::PENDING,
    ];

    protected function casts(): array
    {
        return [
            'date_of_joining' => 'date:Y-m-d',
            'last_working_date' => 'date:Y-m-d',
            'service_years' => 'float',
            'monthly_gross' => 'float',
            'monthly_basic' => 'float',
            'paid_days' => 'float',
            'working_days' => 'float',
            'notice_served_days' => 'integer',
            'notice_required_days' => 'integer',
            'notice_shortfall_days' => 'integer',
            'total_earnings' => 'float',
            'total_deductions' => 'float',
            'net_payable' => 'float',
            'recoverable' => 'float',
            'calculated_at' => 'datetime',
            'approved_at' => 'datetime',
            'settled_at' => 'datetime',
        ];
    }

    public function exit(): BelongsTo
    {
        return $this->belongsTo(EmployeeExit::class, 'employee_exit_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(FnfLine::class, 'settlement_id')->orderBy('sequence')->orderBy('id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        return $query->whereHas('employee.user', fn (Builder $inner) => DataScope::apply($inner, $actor));
    }

    public function isEditable(): bool
    {
        return in_array($this->status, [self::DRAFT, self::CALCULATED], true);
    }

    public function isApproved(): bool
    {
        return $this->status === self::APPROVED;
    }

    public function isSettled(): bool
    {
        return $this->status === self::SETTLED;
    }

    public function owesCompany(): bool
    {
        return (float) $this->net_payable < 0;
    }

    public function isTransferable(): bool
    {
        return $this->isApproved()
            && (float) $this->net_payable > 0
            && in_array($this->payment_status, [self::PENDING, self::FAILED], true);
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::DRAFT => 'Draft',
            self::CALCULATED => 'Calculated',
            self::APPROVED => 'Approved',
            self::SETTLED => 'Settled',
            self::CANCELLED => 'Cancelled',
            default => $this->status,
        };
    }

    public function paymentLabel(): string
    {
        if ($this->owesCompany()) {
            return 'Employee owes the company';
        }

        return match ($this->payment_status) {
            self::PENDING => 'Not sent yet',
            self::PROCESSING => 'With the bank',
            self::PAID => 'Paid',
            self::FAILED => 'Failed',
            self::ON_HOLD => 'On hold',
            self::RECOVERABLE => 'To be recovered',
            default => $this->payment_status,
        };
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->visibleTo(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }
}

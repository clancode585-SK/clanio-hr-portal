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

class SalaryAdvance extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const DISBURSED = 'disbursed';

    public const CLOSED = 'closed';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [
        self::PENDING, self::APPROVED, self::REJECTED,
        self::DISBURSED, self::CLOSED, self::CANCELLED,
    ];

    public const PAY_PENDING = 'pending';

    public const PAY_PROCESSING = 'processing';

    public const PAY_PAID = 'paid';

    public const PAY_FAILED = 'failed';

    public const ON_HOLD = 'on_hold';

    public const VIEW_PERMISSION = 'advance.view';

    public const APPROVE_PERMISSION = 'advance.approve';

    public const MANAGE_PERMISSION = 'advance.manage';

    protected $fillable = [
        'reason',
    ];

    protected $attributes = [
        'status' => self::PENDING,
        'payment_status' => self::PAY_PENDING,
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'emi_amount' => 'float',
            'tenure_months' => 'integer',
            'recovered' => 'float',
            'outstanding' => 'float',
            'requested_at' => 'datetime',
            'decided_at' => 'datetime',
            'disbursed_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function recoveries(): HasMany
    {
        return $this->hasMany(SalaryAdvanceRecovery::class, 'advance_id')->orderBy('period');
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        return $query->whereHas('employee.user', fn (Builder $inner) => DataScope::apply($inner, $actor));
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::APPROVED;
    }

    public function isDisbursed(): bool
    {
        return $this->status === self::DISBURSED;
    }

    public function isClosed(): bool
    {
        return $this->status === self::CLOSED;
    }

    // Paisa tabhi jaayega jab approve ho chuka ho aur abhi tak bheja na gaya ho
    public function isTransferable(): bool
    {
        return $this->isApproved()
            && (float) $this->amount > 0
            && in_array($this->payment_status, [self::PAY_PENDING, self::PAY_FAILED], true);
    }

    // Payroll isi par EMI kaatta hai
    public function isRecovering(): bool
    {
        return $this->isDisbursed() && (float) $this->outstanding > 0;
    }

    public function instalmentsLeft(): int
    {
        $emi = (float) $this->emi_amount;

        return $emi > 0 ? (int) ceil((float) $this->outstanding / $emi) : 0;
    }

    public function dueFor(string $period): float
    {
        if (! $this->isRecovering()) {
            return 0.0;
        }

        if ($this->start_period !== null && $period < $this->start_period) {
            return 0.0;
        }

        return round(min((float) $this->emi_amount, (float) $this->outstanding), 2);
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::PENDING => 'Approval ka intezaar',
            self::APPROVED => 'Approved — transfer baaki',
            self::REJECTED => 'Reject ho gaya',
            self::DISBURSED => 'Chal raha hai',
            self::CLOSED => 'Pura ho gaya',
            self::CANCELLED => 'Cancel',
            default => $this->status,
        };
    }
}

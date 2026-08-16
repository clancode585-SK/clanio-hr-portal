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

class ExpenseClaim extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    /** Employee ne bheja — manager ke paas hai */
    public const PENDING = 'pending';

    /** Manager ne approve kiya — HR verify karegi */
    public const MANAGER_APPROVED = 'manager_approved';

    /** HR ne verify kiya — ab payment ho sakta hai */
    public const VERIFIED = 'verified';

    public const PAID = 'paid';

    public const REJECTED = 'rejected';

    public const CANCELLED = 'cancelled';

    public const STATUSES = [
        self::PENDING,
        self::MANAGER_APPROVED,
        self::VERIFIED,
        self::PAID,
        self::REJECTED,
        self::CANCELLED,
    ];

    public const OTHER = 'other';

    /** Dropdown ki list — koi amount limit nahi, employee khud daalta hai */
    public const CATEGORIES = [
        'travel' => 'Travel — cab, train, flight, hotel',
        'food' => 'Food — client meeting ya overtime meal',
        'internet' => 'Internet — broadband ya mobile data',
        'fuel' => 'Fuel — petrol, diesel, toll',
        'stationery' => 'Stationery — office ka saamaan',
        'repair' => 'Repair — laptop, mobile, equipment theek karana',
        'medical' => 'Medical',
        'training' => 'Training — course, certification, book',
        self::OTHER => 'Other — kuch aur',
    ];

    public const STAGE_MANAGER = 'manager';

    public const STAGE_HR = 'hr';

    public const MODE_BANK = 'bank_transfer';

    public const MODE_UPI = 'upi';

    public const MODE_CASH = 'cash';

    public const MODE_PAYROLL = 'payroll';

    public const PAYMENT_MODES = [self::MODE_BANK, self::MODE_UPI, self::MODE_CASH, self::MODE_PAYROLL];

    public const VERIFY_PERMISSION = 'expense.verify';

    public const PAY_PERMISSION = 'expense.pay';

    public const DEFAULT_WINDOW_DAYS = 60;

    protected $fillable = [
        'category',
        'purpose',
        'expense_date',
        'amount',
        'description',
    ];

    protected $attributes = [
        'status' => self::PENDING,
    ];

    protected $hidden = ['is_open'];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date:Y-m-d',
            'amount' => 'float',
            'approved_amount' => 'float',
            'payable_amount' => 'float',
            'approved_at' => 'datetime',
            'verified_at' => 'datetime',
            'rejected_at' => 'datetime',
            'paid_on' => 'date:Y-m-d',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['is_open', 'payable_amount', 'created_at', 'updated_at'];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        if ($actor === null || $actor->isSuperAdmin() || $actor->hasPermission(DataScope::OVERRIDE)) {
            return $query;
        }

        if ($actor->hasPermission(self::VERIFY_PERMISSION) || $actor->hasPermission(self::PAY_PERMISSION)) {
            return $query;
        }

        return $query->whereHas('employee', fn (Builder $employee) => $employee
            ->where('reporting_manager_id', $actor->id)
            ->orWhere('user_id', $actor->id)
            ->orWhereHas('user', fn (Builder $user) => DataScope::apply($user, $actor)));
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->visibleTo(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function bills(): HasMany
    {
        return $this->hasMany(ExpenseBill::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isManagerApproved(): bool
    {
        return $this->status === self::MANAGER_APPROVED;
    }

    public function isVerified(): bool
    {
        return $this->status === self::VERIFIED;
    }

    public function isClosed(): bool
    {
        return in_array($this->status, [self::PAID, self::REJECTED, self::CANCELLED], true);
    }

    public function payable(): float
    {
        return (float) ($this->approved_amount ?? $this->amount);
    }

    public function categoryLabel(): string
    {
        if ($this->category === self::OTHER && $this->purpose !== null) {
            return 'Other — ' . $this->purpose;
        }

        return self::CATEGORIES[$this->category] ?? $this->category;
    }

    public function stageLabel(): string
    {
        return match ($this->status) {
            self::PENDING => 'Manager ke paas',
            self::MANAGER_APPROVED => 'HR verification ke paas',
            self::VERIFIED => 'Payment pending',
            self::PAID => 'Paid',
            self::REJECTED => 'Rejected',
            self::CANCELLED => 'Cancelled',
            default => $this->status,
        };
    }
}

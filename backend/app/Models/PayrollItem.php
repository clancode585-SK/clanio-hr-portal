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

class PayrollItem extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const PENDING = 'pending';

    public const PROCESSING = 'processing';

    public const PAID = 'paid';

    public const FAILED = 'failed';

    public const ON_HOLD = 'on_hold';

    public const PAYMENT_STATUSES = [self::PENDING, self::PROCESSING, self::PAID, self::FAILED, self::ON_HOLD];

    protected $fillable = [
        'lop_days',
        'note',
    ];

    protected $attributes = [
        'payment_status' => self::PENDING,
    ];

    protected function casts(): array
    {
        return [
            'annual_ctc' => 'float',
            'working_days' => 'float',
            'lop_days' => 'float',
            'paid_days' => 'float',
            'lop_suggested' => 'float',
            'lop_locked_by_hr' => 'boolean',
            'gross_earnings' => 'float',
            'total_deductions' => 'float',
            'employer_cost' => 'float',
            'net_payable' => 'float',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'run_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PayrollItemLine::class, 'item_id')->orderBy('sequence')->orderBy('id');
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        return $query->whereHas('employee.user', fn (Builder $inner) => DataScope::apply($inner, $actor));
    }

    public function isPaid(): bool
    {
        return $this->payment_status === self::PAID;
    }

    public function isOnHold(): bool
    {
        return $this->payment_status === self::ON_HOLD;
    }

    public function isTransferable(): bool
    {
        return in_array($this->payment_status, [self::PENDING, self::FAILED], true)
            && (float) $this->net_payable > 0;
    }

    public function paymentLabel(): string
    {
        return match ($this->payment_status) {
            self::PENDING => 'Not sent yet',
            self::PROCESSING => 'With the bank',
            self::PAID => 'Paid',
            self::FAILED => 'Failed',
            self::ON_HOLD => 'On hold',
            default => $this->payment_status,
        };
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery($this->newQuery(), $value, $field)->firstOrFail();
    }
}

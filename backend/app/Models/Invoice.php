<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    use Auditable;
    use HasActiveState;
    use HasUuid;

    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_PENDING, self::STATUS_PAID, self::STATUS_CANCELLED];

    protected $fillable = [
        'plan_id',
        'invoice_number',
        'plan_name',
        'plan_code',
        'seats',
        'price_per_seat',
        'currency',
        'billing_cycle',
        'subtotal',
        'gst_percent',
        'gst_amount',
        'total',
        'status',
        'period_start',
        'period_end',
        'issued_at',
        'paid_at',
        'payment_method',
        'payment_reference',
        'billed_to_name',
        'billed_to_email',
        'billed_to_gstin',
        'billed_to_address',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'seats' => 'integer',
            'price_per_seat' => 'float',
            'subtotal' => 'float',
            'gst_percent' => 'float',
            'gst_amount' => 'float',
            'total' => 'float',
            'period_start' => 'date',
            'period_end' => 'date',
            'issued_at' => 'datetime',
            'paid_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    protected function auditSensitive(): array
    {
        return ['billed_to_address', 'billed_to_gstin'];
    }
}

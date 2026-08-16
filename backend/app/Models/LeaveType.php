<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaveType extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const YEARLY = 'yearly';

    public const MONTHLY = 'monthly';

    public const ACCRUALS = [self::YEARLY, self::MONTHLY];

    public const AUDIENCES = ['all', 'male', 'female'];

    public const DEFAULTS = [
        ['name' => 'Casual Leave', 'code' => 'CL', 'description' => 'Short personal leave', 'annual_quota' => 12, 'accrual_type' => self::MONTHLY, 'min_notice_days' => 1, 'max_consecutive_days' => 3, 'sort_order' => 1],
        ['name' => 'Sick Leave', 'code' => 'SL', 'description' => 'Illness ke liye', 'annual_quota' => 12, 'accrual_type' => self::MONTHLY, 'requires_document' => true, 'sort_order' => 2],
        ['name' => 'Earned Leave', 'code' => 'EL', 'description' => 'Privilege leave, carry forward hoti hai', 'annual_quota' => 15, 'accrual_type' => self::MONTHLY, 'min_notice_days' => 3, 'carry_forward' => true, 'carry_forward_max' => 30, 'is_encashable' => true, 'encashment_max' => 15, 'sort_order' => 3],
        ['name' => 'Maternity Leave', 'code' => 'ML', 'description' => 'Maternity benefit', 'annual_quota' => 182, 'allow_half_day' => false, 'min_notice_days' => 30, 'max_consecutive_days' => 182, 'applicable_to' => 'female', 'requires_document' => true, 'sort_order' => 4],
        ['name' => 'Paternity Leave', 'code' => 'PL', 'description' => 'Paternity leave', 'annual_quota' => 15, 'allow_half_day' => false, 'min_notice_days' => 15, 'max_consecutive_days' => 15, 'applicable_to' => 'male', 'sort_order' => 5],
        ['name' => 'Leave Without Pay', 'code' => 'LWP', 'description' => 'Balance khatam hone par unpaid leave', 'is_paid' => false, 'annual_quota' => 0, 'sort_order' => 6],
    ];

    protected $fillable = [
        'name',
        'code',
        'description',
        'is_paid',
        'annual_quota',
        'accrual_type',
        'allow_half_day',
        'min_notice_days',
        'max_consecutive_days',
        'carry_forward',
        'carry_forward_max',
        'is_encashable',
        'encashment_max',
        'applicable_to',
        'min_service_months',
        'count_weekly_off',
        'count_holiday',
        'requires_document',
        'sort_order',
        'status',
    ];

    protected $attributes = [
        'is_paid' => true,
        'annual_quota' => 0,
        'accrual_type' => self::YEARLY,
        'allow_half_day' => true,
        'min_notice_days' => 0,
        'carry_forward' => false,
        'is_encashable' => false,
        'applicable_to' => 'all',
        'min_service_months' => 0,
        'count_weekly_off' => false,
        'count_holiday' => false,
        'requires_document' => false,
        'sort_order' => 0,
        'status' => 'active',
    ];

    protected function casts(): array
    {
        return [
            'is_paid' => 'boolean',
            'allow_half_day' => 'boolean',
            'carry_forward' => 'boolean',
            'is_encashable' => 'boolean',
            'count_weekly_off' => 'boolean',
            'count_holiday' => 'boolean',
            'requires_document' => 'boolean',
            'annual_quota' => 'float',
            'carry_forward_max' => 'float',
            'encashment_max' => 'float',
            'min_notice_days' => 'integer',
            'max_consecutive_days' => 'integer',
            'min_service_months' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function balances(): HasMany
    {
        return $this->hasMany(LeaveBalance::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function tracksBalance(): bool
    {
        return $this->is_paid && $this->annual_quota > 0;
    }

    public function accruesMonthly(): bool
    {
        return $this->accrual_type === self::MONTHLY;
    }

    public function monthlyAccrual(): float
    {
        return round($this->annual_quota / 12, 2);
    }

    public function carryForwardCap(): float
    {
        return $this->carry_forward_max ?? $this->annual_quota;
    }

    public function encashmentCap(): float
    {
        return $this->encashment_max ?? $this->annual_quota;
    }

    public function allowsGender(?string $gender): bool
    {
        return $this->applicable_to === 'all' || $this->applicable_to === $gender;
    }
}

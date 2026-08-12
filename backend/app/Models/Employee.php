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

class Employee extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const ONBOARDING_IN_PROGRESS = 'in_progress';

    public const ONBOARDING_COMPLETED = 'completed';

    public const EMPLOYMENT_ACTIVE = 'active';

    public const EMPLOYMENT_SERVING_NOTICE = 'serving_notice';

    public const EMPLOYMENT_EXITED = 'exited';

    public const EMPLOYMENT_STATUSES = [
        self::EMPLOYMENT_ACTIVE,
        self::EMPLOYMENT_SERVING_NOTICE,
        self::EMPLOYMENT_EXITED,
    ];

    protected $fillable = [
        'employee_code',
        'designation_id',
        'work_shift_id',
        'reporting_manager_id',
        'date_of_joining',
        'employment_type',
        'probation_end_date',
        'confirmation_date',
        'date_of_birth',
        'gender',
        'marital_status',
        'blood_group',
        'personal_email',
        'personal_phone',
        'current_address',
        'permanent_address',
        'emergency_contact_name',
        'emergency_contact_relation',
        'emergency_contact_phone',
        'pan_number',
    ];

    protected $attributes = [
        'employment_type' => 'full_time',
        'onboarding_status' => self::ONBOARDING_IN_PROGRESS,
        'employment_status' => self::EMPLOYMENT_ACTIVE,
    ];

    protected function casts(): array
    {
        return [
            'date_of_joining' => 'date:Y-m-d',
            'probation_end_date' => 'date:Y-m-d',
            'confirmation_date' => 'date:Y-m-d',
            'date_of_birth' => 'date:Y-m-d',
            'exit_date' => 'date:Y-m-d',
            'policy_gate_cleared_at' => 'datetime',
        ];
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        return $query->whereHas('user', fn (Builder $inner) => DataScope::apply($inner, $actor));
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->visibleTo(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function designation(): BelongsTo
    {
        return $this->belongsTo(Designation::class);
    }

    public function workShift(): BelongsTo
    {
        return $this->belongsTo(WorkShift::class);
    }

    public function reportingManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporting_manager_id');
    }

    public function familyMembers(): HasMany
    {
        return $this->hasMany(EmployeeFamilyMember::class);
    }

    public function bankAccounts(): HasMany
    {
        return $this->hasMany(EmployeeBankAccount::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function exits(): HasMany
    {
        return $this->hasMany(EmployeeExit::class);
    }

    public function policyAcknowledgements(): HasMany
    {
        return $this->hasMany(PolicyAcknowledgement::class);
    }

    public function hasClearedPolicyGate(): bool
    {
        return $this->policy_gate_cleared_at !== null;
    }

    public function isOnboardingComplete(): bool
    {
        return $this->onboarding_status === self::ONBOARDING_COMPLETED;
    }

    public function isExited(): bool
    {
        return $this->employment_status === self::EMPLOYMENT_EXITED;
    }

    public function isServingNotice(): bool
    {
        return $this->employment_status === self::EMPLOYMENT_SERVING_NOTICE;
    }
}

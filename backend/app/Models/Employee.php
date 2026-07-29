<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use App\Support\DataScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    public const ONBOARDING_IN_PROGRESS = 'in_progress';

    public const ONBOARDING_COMPLETED = 'completed';

    protected $fillable = [
        'employee_code',
        'designation_id',
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
    ];

    protected function casts(): array
    {
        return [
            'date_of_joining' => 'date:Y-m-d',
            'probation_end_date' => 'date:Y-m-d',
            'confirmation_date' => 'date:Y-m-d',
            'date_of_birth' => 'date:Y-m-d',
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

    public function isOnboardingComplete(): bool
    {
        return $this->onboarding_status === self::ONBOARDING_COMPLETED;
    }
}

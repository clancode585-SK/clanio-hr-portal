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

class JobOpening extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const STATUS_REQUESTED = 'requested';

    public const STATUS_DECLINED = 'declined';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_OPEN = 'open';

    public const STATUS_ON_HOLD = 'on_hold';

    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [
        self::STATUS_REQUESTED,
        self::STATUS_DECLINED,
        self::STATUS_DRAFT,
        self::STATUS_OPEN,
        self::STATUS_ON_HOLD,
        self::STATUS_CLOSED,
    ];

    public const HR_STATUSES = [self::STATUS_DRAFT, self::STATUS_OPEN, self::STATUS_ON_HOLD, self::STATUS_CLOSED];

    public const WORK_MODES = ['onsite', 'hybrid', 'remote'];

    public const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'intern', 'contract', 'consultant'];

    protected $fillable = [
        'slug',
        'title',
        'department_id',
        'designation_id',
        'branch_id',
        'location',
        'work_mode',
        'employment_type',
        'experience_min',
        'experience_max',
        'positions',
        'salary_min',
        'salary_max',
        'show_salary',
        'summary',
        'responsibilities',
        'requirements',
        'nice_to_have',
        'status',
        'closes_on',
        'request_note',
    ];

    protected $attributes = [
        'status' => self::STATUS_DRAFT,
        'work_mode' => 'onsite',
        'employment_type' => 'full_time',
        'experience_min' => 0,
        'positions' => 1,
        'show_salary' => false,
    ];

    protected function casts(): array
    {
        return [
            'experience_min' => 'float',
            'experience_max' => 'float',
            'positions' => 'integer',
            'salary_min' => 'float',
            'salary_max' => 'float',
            'show_salary' => 'boolean',
            'published_at' => 'datetime',
            'closed_at' => 'datetime',
            'requested_at' => 'datetime',
            'approved_at' => 'datetime',
            'closes_on' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function designation(): BelongsTo
    {
        return $this->belongsTo(Designation::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function needsApproval(): bool
    {
        return $this->status === self::STATUS_REQUESTED;
    }

    public function isLive(): bool
    {
        if ($this->status !== self::STATUS_OPEN) {
            return false;
        }

        return $this->closes_on === null || ! $this->closes_on->isPast();
    }

    public function experienceLabel(): string
    {
        $min = $this->trim($this->experience_min);

        if ($this->experience_max === null) {
            return $min === '0' ? 'Fresher welcome' : $min . '+ Years';
        }

        return $min . '-' . $this->trim($this->experience_max) . ' Years';
    }

    public function responsibilityList(): array
    {
        return self::lines($this->responsibilities);
    }

    public function requirementList(): array
    {
        return self::lines($this->requirements);
    }

    public function niceToHaveList(): array
    {
        return self::lines($this->nice_to_have);
    }

    public static function lines(?string $value): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string) $value) ?: [])));
    }

    private function trim(float $value): string
    {
        return rtrim(rtrim(number_format($value, 1, '.', ''), '0'), '.');
    }
}

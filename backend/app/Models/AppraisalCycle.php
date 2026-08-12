<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AppraisalCycle extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    /** HR bana rahi hai, employees ko nahi dikha */
    public const DRAFT = 'draft';

    /** Launch ho gaya — employee self review bhar raha hai */
    public const SELF_REVIEW = 'self_review';

    /** Manager review kar raha hai */
    public const MANAGER_REVIEW = 'manager_review';

    /** HR final rating de rahi hai */
    public const HR_REVIEW = 'hr_review';

    public const CLOSED = 'closed';

    public const STATUSES = [
        self::DRAFT,
        self::SELF_REVIEW,
        self::MANAGER_REVIEW,
        self::HR_REVIEW,
        self::CLOSED,
    ];

    public const MANAGE_PERMISSION = 'performance.manage';

    public const FINALISE_PERMISSION = 'performance.finalise';

    protected $fillable = [
        'name',
        'period_start',
        'period_end',
        'self_review_due',
        'manager_review_due',
        'rating_scale',
    ];

    protected $attributes = [
        'rating_scale' => 5,
        'status' => self::DRAFT,
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'self_review_due' => 'date:Y-m-d',
            'manager_review_due' => 'date:Y-m-d',
            'rating_scale' => 'integer',
            'launched_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function appraisals(): HasMany
    {
        return $this->hasMany(Appraisal::class);
    }

    public function goals(): HasMany
    {
        return $this->hasMany(PerformanceGoal::class);
    }

    public function isDraft(): bool
    {
        return $this->status === self::DRAFT;
    }

    public function isClosed(): bool
    {
        return $this->status === self::CLOSED;
    }

    public function stageLabel(): string
    {
        return match ($this->status) {
            self::DRAFT => 'Draft — abhi launch nahi hua',
            self::SELF_REVIEW => 'Employee self review bhar raha hai',
            self::MANAGER_REVIEW => 'Manager review kar raha hai',
            self::HR_REVIEW => 'HR final rating de rahi hai',
            self::CLOSED => 'Closed',
            default => $this->status,
        };
    }
}

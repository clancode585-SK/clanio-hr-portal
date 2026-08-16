<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PerformanceScore extends Model
{
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    protected $fillable = [
        'period_month',
        'score',
        'delivery_score',
        'discipline_score',
        'penalty',
        'goal_score',
        'tasks_assigned',
        'tasks_done',
        'tasks_overdue',
        'on_time_percent',
        'report_expected',
        'report_completed',
        'report_compliance_percent',
        'present_days',
        'absent_days',
        'late_days',
        'leave_days',
        'hours_logged',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'period_month' => 'date:Y-m-d',
            'score' => 'integer',
            'delivery_score' => 'integer',
            'discipline_score' => 'integer',
            'penalty' => 'integer',
            'goal_score' => 'integer',
            'tasks_assigned' => 'integer',
            'tasks_done' => 'integer',
            'tasks_overdue' => 'integer',
            'on_time_percent' => 'integer',
            'report_expected' => 'integer',
            'report_completed' => 'integer',
            'report_compliance_percent' => 'integer',
            'present_days' => 'integer',
            'absent_days' => 'integer',
            'late_days' => 'integer',
            'leave_days' => 'float',
            'hours_logged' => 'float',
            'is_frozen' => 'boolean',
            'frozen_at' => 'datetime',
            'computed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function isFrozen(): bool
    {
        return (bool) $this->is_frozen;
    }
}

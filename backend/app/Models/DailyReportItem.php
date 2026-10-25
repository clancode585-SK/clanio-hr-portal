<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyReportItem extends Model
{
    use BelongsToCompany;
    use HasUuid;

    public const SOD = 'sod';

    public const EOD = 'eod';

    public const SECTIONS = [self::SOD, self::EOD];

    public const NOT_STARTED = 'not_started';

    public const PENDING = 'pending';

    public const WIP = 'wip';

    public const COMPLETED = 'completed';

    public const STATUSES = [self::NOT_STARTED, self::PENDING, self::WIP, self::COMPLETED];

    protected $fillable = [
        'section',
        'task_id',
        'title',
        'hours',
        'status',
        'sort_order',
    ];

    protected $attributes = [
        'status' => self::NOT_STARTED,
        'sort_order' => 0,
    ];

    protected function casts(): array
    {
        return [
            'hours' => 'float',
            'sort_order' => 'integer',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(DailyReport::class, 'daily_report_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Interview extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const KIND_TELEPHONIC = 'telephonic';

    public const KIND_TECHNICAL = 'technical';

    public const KIND_MANAGERIAL = 'managerial';

    public const KIND_HR = 'hr';

    public const KIND_FINAL = 'final';

    public const KINDS = [
        self::KIND_TELEPHONIC,
        self::KIND_TECHNICAL,
        self::KIND_MANAGERIAL,
        self::KIND_HR,
        self::KIND_FINAL,
    ];

    public const MODE_VIDEO = 'video';

    public const MODE_IN_PERSON = 'in_person';

    public const MODE_PHONE = 'phone';

    public const MODES = [self::MODE_VIDEO, self::MODE_IN_PERSON, self::MODE_PHONE];

    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_DONE = 'done';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_NO_SHOW = 'no_show';

    public const STATUSES = [self::STATUS_SCHEDULED, self::STATUS_DONE, self::STATUS_CANCELLED, self::STATUS_NO_SHOW];

    public const VERDICT_SELECTED = 'selected';

    public const VERDICT_REJECTED = 'rejected';

    public const VERDICT_HOLD = 'hold';

    public const VERDICTS = [self::VERDICT_SELECTED, self::VERDICT_REJECTED, self::VERDICT_HOLD];

    public const LABELS = [
        self::KIND_TELEPHONIC => 'Telephonic screening',
        self::KIND_TECHNICAL => 'Technical round',
        self::KIND_MANAGERIAL => 'Managerial round',
        self::KIND_HR => 'HR round',
        self::KIND_FINAL => 'Final round',
    ];

    protected $fillable = [
        'application_id',
        'round_no',
        'title',
        'kind',
        'mode',
        'interviewer_id',
        'scheduled_at',
        'duration_minutes',
        'location',
    ];

    protected $attributes = [
        'kind' => self::KIND_TECHNICAL,
        'mode' => self::MODE_VIDEO,
        'status' => self::STATUS_SCHEDULED,
        'round_no' => 1,
        'duration_minutes' => 45,
    ];

    protected function casts(): array
    {
        return [
            'round_no' => 'integer',
            'duration_minutes' => 'integer',
            'rating' => 'integer',
            'scheduled_at' => 'datetime',
            'submitted_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function interviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'interviewer_id');
    }

    public function label(): string
    {
        return $this->title ?: (self::LABELS[$this->kind] ?? ucfirst((string) $this->kind));
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_SCHEDULED;
    }

    public function endsAt(): ?\Illuminate\Support\Carbon
    {
        return $this->scheduled_at?->copy()->addMinutes($this->duration_minutes);
    }
}

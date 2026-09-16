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
use Illuminate\Database\Eloquent\Relations\HasOne;

class Application extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const STAGE_APPLIED = 'applied';

    public const STAGE_SCREENING = 'screening';

    public const STAGE_INTERVIEW = 'interview';

    public const STAGE_OFFER = 'offer';

    public const STAGE_JOINED = 'joined';

    public const STAGE_REJECTED = 'rejected';

    public const STAGE_DROPPED = 'dropped';

    public const STAGES = [
        self::STAGE_APPLIED,
        self::STAGE_SCREENING,
        self::STAGE_INTERVIEW,
        self::STAGE_OFFER,
        self::STAGE_JOINED,
        self::STAGE_REJECTED,
        self::STAGE_DROPPED,
    ];

    public const OPEN_STAGES = [
        self::STAGE_APPLIED,
        self::STAGE_SCREENING,
        self::STAGE_INTERVIEW,
        self::STAGE_OFFER,
    ];

    public const CLOSED_STAGES = [self::STAGE_JOINED, self::STAGE_REJECTED, self::STAGE_DROPPED];

    protected $fillable = [
        'job_opening_id',
        'candidate_id',
        'stage',
        'rating',
        'cover_note',
        'offered_ctc',
        'offer_date',
        'joining_date',
        'rejection_reason',
        'source',
        'source_detail',
    ];

    protected $attributes = [
        'stage' => self::STAGE_APPLIED,
        'source' => 'website',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'offered_ctc' => 'float',
            'offer_date' => 'date',
            'joining_date' => 'date',
            'stage_changed_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function opening(): BelongsTo
    {
        return $this->belongsTo(JobOpening::class, 'job_opening_id');
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function movedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'stage_changed_by');
    }

    public function interviews(): HasMany
    {
        return $this->hasMany(Interview::class);
    }

    public function offerLetter(): HasOne
    {
        return $this->hasOne(OfferLetter::class);
    }

    public function isOpen(): bool
    {
        return in_array($this->stage, self::OPEN_STAGES, true);
    }
}

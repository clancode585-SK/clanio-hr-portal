<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfferLetter extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const STATUS_ISSUED = 'issued';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_DECLINED = 'declined';

    public const STATUS_WITHDRAWN = 'withdrawn';

    public const STATUSES = [
        self::STATUS_ISSUED,
        self::STATUS_ACCEPTED,
        self::STATUS_DECLINED,
        self::STATUS_WITHDRAWN,
    ];

    protected $fillable = [
        'application_id',
        'candidate_name',
        'role_title',
        'designation',
        'department',
        'location',
        'employment_type',
        'annual_ctc',
        'joining_date',
        'reporting_to',
        'probation_months',
        'notice_days',
        'valid_till',
        'extra_terms',
    ];

    protected $attributes = [
        'status' => self::STATUS_ISSUED,
        'probation_months' => 0,
        'notice_days' => 30,
        'employment_type' => 'full_time',
    ];

    protected function casts(): array
    {
        return [
            'annual_ctc' => 'float',
            'probation_months' => 'integer',
            'notice_days' => 'integer',
            'joining_date' => 'date',
            'valid_till' => 'date',
            'issued_at' => 'datetime',
            'responded_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function signer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signed_by');
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_ISSUED;
    }

    public function hasLapsed(): bool
    {
        return $this->isOpen() && $this->valid_till !== null && $this->valid_till->isPast();
    }

    public function termList(): array
    {
        return array_values(array_filter(array_map(
            'trim',
            preg_split('/\r\n|\r|\n/', (string) $this->extra_terms) ?: []
        )));
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FnfLine extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const EARNING = 'earning';

    public const DEDUCTION = 'deduction';

    public const KINDS = [self::EARNING, self::DEDUCTION];

    public const AUTO = 'auto';

    public const SUGGESTED = 'suggested';

    public const MANUAL = 'manual';

    public const SOURCES = [self::AUTO, self::SUGGESTED, self::MANUAL];

    public const SALARY = 'SALARY';

    public const NOTICE_SHORTFALL = 'NOTICE_SHORT';

    public const NOTICE_PAY = 'NOTICE_PAY';

    public const LEAVE_ENCASHMENT = 'LEAVE_ENCASH';

    public const GRATUITY = 'GRATUITY';

    public const CLEARANCE_RECOVERY = 'CLEARANCE';

    protected $fillable = [
        'code',
        'name',
        'kind',
        'amount',
        'note',
        'sequence',
    ];

    protected $attributes = [
        'kind' => self::EARNING,
        'source' => self::MANUAL,
        'is_applied' => true,
        'amount' => 0,
        'suggested_amount' => 0,
        'sequence' => 100,
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'suggested_amount' => 'float',
            'is_applied' => 'boolean',
            'sequence' => 'integer',
        ];
    }

    public function settlement(): BelongsTo
    {
        return $this->belongsTo(FnfSettlement::class, 'settlement_id');
    }

    public function isEarning(): bool
    {
        return $this->kind === self::EARNING;
    }

    public function isSuggestion(): bool
    {
        return $this->source === self::SUGGESTED;
    }

    public function counts(): bool
    {
        return $this->is_applied && (float) $this->amount !== 0.0;
    }
}

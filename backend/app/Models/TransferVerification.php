<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class TransferVerification extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const SALARY_RUN = 'salary_run';

    public const SALARY_ITEM = 'salary_item';

    public const SETTLEMENT = 'settlement';

    public const ADVANCE = 'advance';

    public const PURPOSES = [self::SALARY_RUN, self::SALARY_ITEM, self::SETTLEMENT, self::ADVANCE];

    public const TRANSFER = 'transfer';

    public const SCHEDULE = 'schedule';

    public const ACTIONS = [self::TRANSFER, self::SCHEDULE];

    public const PENDING = 'pending';

    public const VERIFIED = 'verified';

    public const CONSUMED = 'consumed';

    public const EXPIRED = 'expired';

    public const CANCELLED = 'cancelled';

    public const MAX_ATTEMPTS = 5;

    protected $attributes = [
        'action' => self::TRANSFER,
        'status' => self::PENDING,
        'channel' => 'email',
        'attempts' => 0,
        'headcount' => 0,
        'amount' => 0,
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'headcount' => 'integer',
            'attempts' => 'integer',
            'scheduled_for' => 'datetime',
            'expires_at' => 'datetime',
            'verified_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isVerified(): bool
    {
        return $this->status === self::VERIFIED;
    }

    public function hasExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isUsable(): bool
    {
        return in_array($this->status, [self::PENDING, self::VERIFIED], true) && ! $this->hasExpired();
    }

    public function minutesLeft(): int
    {
        if ($this->expires_at === null) {
            return 0;
        }

        return max((int) ceil(Carbon::now()->diffInSeconds($this->expires_at, false) / 60), 0);
    }

    public function triesLeft(): int
    {
        return max(self::MAX_ATTEMPTS - (int) $this->attempts, 0);
    }

    public function matches(string $purpose, ?int $runId, ?int $itemId, ?int $settlementId, string $action): bool
    {
        return $this->purpose === $purpose
            && $this->action === $action
            && (int) $this->run_id === (int) $runId
            && (int) $this->item_id === (int) $itemId
            && (int) $this->settlement_id === (int) $settlementId;
    }
}

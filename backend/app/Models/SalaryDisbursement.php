<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryDisbursement extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const QUEUED = 'queued';

    public const PROCESSING = 'processing';

    public const SUCCESS = 'success';

    public const FAILED = 'failed';

    public const STATUSES = [self::QUEUED, self::PROCESSING, self::SUCCESS, self::FAILED];

    public const BULK = 'bulk';

    public const MANUAL = 'manual';

    public const PERMISSION = 'salary.disburse';

    protected $attributes = [
        'status' => self::QUEUED,
        'mode' => self::BULK,
        'provider' => 'mock',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'initiated_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'run_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class, 'item_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(CompanyBankAccount::class, 'from_account_id');
    }

    public function isSuccess(): bool
    {
        return $this->status === self::SUCCESS;
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::QUEUED => 'Queued',
            self::PROCESSING => 'With the bank',
            self::SUCCESS => 'Sent',
            self::FAILED => 'Failed',
            default => $this->status,
        };
    }

    public function maskedPayee(): string
    {
        $number = (string) $this->to_account_number;

        return strlen($number) <= 4
            ? $number
            : str_repeat('•', max(strlen($number) - 4, 2)) . substr($number, -4);
    }
}

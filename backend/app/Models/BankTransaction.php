<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankTransaction extends Model
{
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const DEBIT = 'debit';

    public const CREDIT = 'credit';

    protected $fillable = [
        'direction',
        'amount',
        'balance_after',
        'narration',
        'reference',
        'happened_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'balance_after' => 'float',
            'happened_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(CompanyBankAccount::class, 'account_id');
    }

    public function disbursement(): BelongsTo
    {
        return $this->belongsTo(SalaryDisbursement::class, 'disbursement_id');
    }

    public function isDebit(): bool
    {
        return $this->direction === self::DEBIT;
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CompanyBankAccount extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const VIEW_PERMISSION = 'company_bank.view';

    public const MANAGE_PERMISSION = 'company_bank.manage';

    protected $fillable = [
        'label',
        'account_holder_name',
        'bank_name',
        'account_number',
        'ifsc_code',
        'branch_name',
        'contact_email',
        'is_primary',
        'balance',
    ];

    protected $attributes = [
        'provider' => 'mock',
        'is_primary' => false,
        'balance' => 0,
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'balance' => 'float',
            'balance_synced_at' => 'datetime',
        ];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BankTransaction::class, 'account_id')->orderByDesc('id');
    }

    public function disbursements(): HasMany
    {
        return $this->hasMany(SalaryDisbursement::class, 'from_account_id');
    }

    public function masked(): string
    {
        $number = (string) $this->account_number;

        return strlen($number) <= 4
            ? $number
            : str_repeat('•', max(strlen($number) - 4, 2)) . substr($number, -4);
    }
}

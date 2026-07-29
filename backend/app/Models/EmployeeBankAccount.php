<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeBankAccount extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'account_holder_name',
        'bank_name',
        'account_number',
        'ifsc_code',
        'branch_name',
        'account_type',
        'is_primary',
    ];

    protected $attributes = [
        'account_type' => 'savings',
        'is_primary' => false,
    ];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean'];
    }

    protected function auditSensitive(): array
    {
        return ['account_number'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function maskedAccountNumber(): string
    {
        $number = (string) $this->account_number;
        $visible = substr($number, -4);

        return str_repeat('X', max(strlen($number) - 4, 0)) . $visible;
    }
}

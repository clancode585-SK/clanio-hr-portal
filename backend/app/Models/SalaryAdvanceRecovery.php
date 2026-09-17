<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryAdvanceRecovery extends Model
{
    use BelongsToCompany;

    public const PAYROLL = 'payroll';

    public const FNF = 'fnf';

    public const MANUAL = 'manual';

    protected $fillable = [
        'period',
        'amount',
        'source',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
        ];
    }

    public function advance(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvance::class, 'advance_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class, 'item_id');
    }
}

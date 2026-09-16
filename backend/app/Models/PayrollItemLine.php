<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollItemLine extends Model
{
    use BelongsToCompany;

    protected $table = 'payroll_item_lines';

    protected $fillable = [
        'code',
        'name',
        'kind',
        'full_amount',
        'amount',
        'is_statutory',
        'sequence',
    ];

    protected function casts(): array
    {
        return [
            'full_amount' => 'float',
            'amount' => 'float',
            'is_statutory' => 'boolean',
            'sequence' => 'integer',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class, 'item_id');
    }
}

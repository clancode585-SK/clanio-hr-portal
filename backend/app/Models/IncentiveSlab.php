<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncentiveSlab extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'from_percent',
        'to_percent',
        'payout_factor',
        'label',
    ];

    protected function casts(): array
    {
        return [
            'from_percent' => 'integer',
            'to_percent' => 'integer',
            'payout_factor' => 'integer',
        ];
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(IncentiveRule::class, 'incentive_rule_id');
    }
}

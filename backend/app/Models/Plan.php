<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasActiveState;
    use HasUuid;

    public const CYCLES = ['monthly', 'yearly'];

    protected $fillable = [
        'name',
        'code',
        'tagline',
        'price_per_seat',
        'currency',
        'billing_cycle',
        'min_seats',
        'max_seats',
        'trial_days',
        'gst_percent',
        'highlights',
        'is_popular',
        'sort_order',
    ];

    protected $casts = [
        'price_per_seat' => 'float',
        'gst_percent' => 'float',
        'min_seats' => 'integer',
        'max_seats' => 'integer',
        'trial_days' => 'integer',
        'sort_order' => 'integer',
        'is_popular' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function companies(): HasMany
    {
        return $this->hasMany(Company::class);
    }

    public function highlightList(): array
    {
        return array_values(array_filter(array_map('trim', explode('|', (string) $this->highlights))));
    }

    public function priceFor(int $seats): array
    {
        $subtotal = round($this->price_per_seat * $seats, 2);
        $gst = round(($subtotal * $this->gst_percent) / 100, 2);

        return [
            'seats' => $seats,
            'price_per_seat' => $this->price_per_seat,
            'subtotal' => $subtotal,
            'gst_percent' => $this->gst_percent,
            'gst' => $gst,
            'total' => round($subtotal + $gst, 2),
            'currency' => $this->currency,
            'billing_cycle' => $this->billing_cycle,
        ];
    }
}

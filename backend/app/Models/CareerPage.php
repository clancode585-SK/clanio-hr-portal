<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;

class CareerPage extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const LAYOUTS = ['cards', 'list'];

    protected $fillable = [
        'headline',
        'intro',
        'layout',
        'accent_color',
        'show_powered_by',
        'allowed_domains',
    ];

    protected $attributes = [
        'layout' => 'cards',
        'accent_color' => '#1B2A6B',
        'show_powered_by' => true,
        'view_count' => 0,
    ];

    protected function casts(): array
    {
        return [
            'show_powered_by' => 'boolean',
            'view_count' => 'integer',
            'intake_count' => 'integer',
            'connected_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'intake_last_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function isConnected(): bool
    {
        return $this->connected_at !== null;
    }

    public function domainList(): array
    {
        return array_values(array_filter(array_map(
            static fn (string $part): string => strtolower(trim($part)),
            explode(',', (string) $this->allowed_domains)
        )));
    }

    public function allows(?string $domain): bool
    {
        $allowed = $this->domainList();

        if ($allowed === [] || $domain === null) {
            return true;
        }

        $host = strtolower(preg_replace('/^www\./', '', $domain) ?? '');

        foreach ($allowed as $entry) {
            $clean = preg_replace('/^www\./', '', $entry) ?? '';

            if ($host === $clean || str_ends_with($host, '.' . $clean)) {
                return true;
            }
        }

        return false;
    }
}

<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Str;

final class Meeting
{
    public static function room(string $companySlug, string $reference, int $round): string
    {
        $slug = Str::slug($companySlug) ?: 'clanio';
        $short = Str::lower(substr(preg_replace('/[^A-Za-z0-9]/', '', $reference) ?: 'x', 0, 8));

        return 'clanio-' . $slug . '-' . $short . '-r' . $round . '-' . Str::lower(Str::random(6));
    }

    public static function url(string $room): string
    {
        $base = rtrim((string) config('services.jitsi.base_url', 'https://meet.jit.si'), '/');

        return $base . '/' . $room;
    }
}

<?php

declare(strict_types=1);

namespace App\Support;

use App\Events\RealtimeEvent;
use Illuminate\Support\Facades\Log;
use Throwable;

final class Realtime
{
    public static function userChannel(int $userId): string
    {
        return 'user.' . $userId;
    }

    public static function companyChannel(int $companyId): string
    {
        return 'company.' . $companyId;
    }

    public static function toUser(int $userId, string $event, array $payload): void
    {
        self::emit([self::userChannel($userId)], $event, $payload);
    }

    public static function toUsers(array $userIds, string $event, array $payload): void
    {
        $channels = [];

        foreach (array_unique(array_map('intval', $userIds)) as $userId) {
            if ($userId > 0) {
                $channels[] = self::userChannel($userId);
            }
        }

        self::emit($channels, $event, $payload);
    }

    public static function toCompany(int $companyId, string $event, array $payload): void
    {
        self::emit([self::companyChannel($companyId)], $event, $payload);
    }

    public static function connection(): array
    {
        return [
            'driver' => (string) config('broadcasting.default'),
            'key' => (string) config('broadcasting.connections.reverb.key'),
            'host' => (string) config('broadcasting.connections.reverb.options.host'),
            'port' => (int) config('broadcasting.connections.reverb.options.port'),
            'scheme' => (string) config('broadcasting.connections.reverb.options.scheme'),
            'force_tls' => (bool) config('broadcasting.connections.reverb.options.useTLS'),
        ];
    }

    private static function emit(array $channels, string $event, array $payload): void
    {
        if ($channels === [] || config('broadcasting.default') === 'null') {
            return;
        }

        try {
            RealtimeEvent::dispatch($channels, $event, $payload + ['emitted_at' => now()->toIso8601String()]);
        } catch (Throwable $exception) {
            Log::warning('Realtime broadcast failed', [
                'event' => $event,
                'channels' => $channels,
                'reason' => $exception->getMessage(),
            ]);
        }
    }
}

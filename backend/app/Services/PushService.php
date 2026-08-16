<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DeviceToken;
use App\Models\User;
use App\Support\Scopes\CompanyScope;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

final class PushService
{
    private const TOKEN_CACHE_KEY = 'fcm:access-token';

    private const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

    private const OAUTH_URL = 'https://oauth2.googleapis.com/token';

    public function register(User $user, array $data): DeviceToken
    {
        $existing = DeviceToken::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('token', $data['token'])
            ->first();

        $device = $existing ?? new DeviceToken();

        $device->fill([
            'platform' => $data['platform'],
            'token' => $data['token'],
            'device_id' => $data['device_id'] ?? null,
            'device_name' => $data['device_name'] ?? null,
            'app_version' => $data['app_version'] ?? null,
        ]);

        $device->company_id = $user->company_id;
        $device->user_id = $user->id;
        $device->last_used_at = Carbon::now();
        $device->revoked_at = null;
        $device->save();

        return $device->refresh();
    }

    public function toUsers(array $userIds, array $notification): int
    {
        if (! $this->configured() || $userIds === []) {
            return 0;
        }

        $devices = DeviceToken::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->active()
            ->whereIn('user_id', $userIds)
            ->get(['id', 'token']);

        if ($devices->isEmpty()) {
            return 0;
        }

        $accessToken = $this->accessToken();

        if ($accessToken === null) {
            return 0;
        }

        $sent = 0;

        foreach ($devices as $device) {
            if ($this->deliver($accessToken, $device, $notification)) {
                $sent++;
            }
        }

        return $sent;
    }

    public function configured(): bool
    {
        return $this->projectId() !== null && $this->credentials() !== null;
    }

    private function deliver(string $accessToken, DeviceToken $device, array $notification): bool
    {
        try {
            $response = Http::withToken($accessToken)
                ->timeout((int) config('services.fcm.timeout', 8))
                ->post('https://fcm.googleapis.com/v1/projects/' . $this->projectId() . '/messages:send', [
                    'message' => [
                        'token' => $device->token,
                        'notification' => [
                            'title' => (string) $notification['title'],
                            'body' => (string) ($notification['body'] ?? ''),
                        ],
                        'data' => $this->stringify([
                            'type' => $notification['type'] ?? '',
                            'entity_type' => $notification['entity_type'] ?? '',
                            'entity_id' => $notification['entity_id'] ?? '',
                            'action_url' => $notification['action_url'] ?? '',
                        ]),
                        'android' => ['priority' => 'high'],
                        'apns' => ['headers' => ['apns-priority' => '10']],
                    ],
                ]);

            if ($response->successful()) {
                $device->forceFill(['last_used_at' => Carbon::now()])->saveQuietly();

                return true;
            }

            if ($this->isDeadToken($response->json())) {
                $device->revoke();
            }

            Log::warning('FCM delivery failed', ['device_id' => $device->id, 'status' => $response->status()]);
        } catch (Throwable $exception) {
            Log::warning('FCM delivery error', ['device_id' => $device->id, 'reason' => $exception->getMessage()]);
        }

        return false;
    }

    private function accessToken(): ?string
    {
        return Cache::remember(self::TOKEN_CACHE_KEY, 3300, function (): ?string {
            $credentials = $this->credentials();

            if ($credentials === null) {
                return null;
            }

            try {
                $now = time();

                $assertion = $this->sign([
                    'iss' => $credentials['client_email'],
                    'scope' => self::SCOPE,
                    'aud' => self::OAUTH_URL,
                    'iat' => $now,
                    'exp' => $now + 3600,
                ], $credentials['private_key']);

                $response = Http::asForm()->timeout(8)->post(self::OAUTH_URL, [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $assertion,
                ]);

                return $response->successful() ? (string) $response->json('access_token') : null;
            } catch (Throwable $exception) {
                Log::warning('FCM token exchange failed', ['reason' => $exception->getMessage()]);

                return null;
            }
        });
    }

    private function sign(array $claims, string $privateKey): string
    {
        $input = $this->encode(['alg' => 'RS256', 'typ' => 'JWT']) . '.' . $this->encode($claims);
        $signature = '';

        openssl_sign($input, $signature, $privateKey, OPENSSL_ALGO_SHA256);

        return $input . '.' . $this->base64($signature);
    }

    private function encode(array $payload): string
    {
        return $this->base64((string) json_encode($payload));
    }

    private function base64(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function credentials(): ?array
    {
        $path = config('services.fcm.credentials');

        if (! is_string($path) || $path === '' || ! is_readable($path)) {
            return null;
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return isset($decoded['client_email'], $decoded['private_key']) ? $decoded : null;
    }

    private function projectId(): ?string
    {
        $projectId = config('services.fcm.project_id');

        return is_string($projectId) && $projectId !== '' ? $projectId : null;
    }

    private function isDeadToken(mixed $body): bool
    {
        $status = is_array($body) ? ($body['error']['status'] ?? null) : null;

        return in_array($status, ['NOT_FOUND', 'INVALID_ARGUMENT', 'UNREGISTERED'], true);
    }

    private function stringify(array $data): array
    {
        return array_map(static fn ($value): string => (string) $value, $data);
    }
}

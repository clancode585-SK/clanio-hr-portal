<?php

declare(strict_types=1);

namespace App\Support\Bank;

use App\Exceptions\ApiException;

final class BankManager
{
    private const DRIVERS = [
        'mock' => MockBank::class,
    ];

    public static function driver(?string $name = null): BankGateway
    {
        $key = $name ?? (string) config('services.bank.driver', 'mock');
        $class = self::DRIVERS[$key] ?? null;

        if ($class === null) {
            throw new ApiException(
                'Bank driver "' . $key . '" set nahi hai. .env me BANK_DRIVER theek karo.',
                500,
                'BANK_DRIVER_MISSING'
            );
        }

        return app($class);
    }

    public static function isMock(): bool
    {
        return self::driver()->name() === 'mock';
    }
}

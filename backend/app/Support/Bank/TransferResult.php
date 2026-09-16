<?php

declare(strict_types=1);

namespace App\Support\Bank;

final class TransferResult
{
    private function __construct(
        public readonly bool $ok,
        public readonly ?string $utr,
        public readonly ?string $reason,
        public readonly bool $pending
    ) {}

    public static function done(string $utr): self
    {
        return new self(true, $utr, null, false);
    }

    public static function queued(string $utr): self
    {
        return new self(true, $utr, null, true);
    }

    public static function failed(string $reason): self
    {
        return new self(false, null, $reason, false);
    }
}

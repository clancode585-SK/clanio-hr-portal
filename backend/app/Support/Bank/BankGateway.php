<?php

declare(strict_types=1);

namespace App\Support\Bank;

interface BankGateway
{
    public function name(): string;

    public function balance(array $account): ?float;

    public function transfer(array $account, array $payee, float $amount, string $reference, string $narration): TransferResult;
}

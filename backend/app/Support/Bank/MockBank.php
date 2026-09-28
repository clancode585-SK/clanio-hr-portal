<?php

declare(strict_types=1);

namespace App\Support\Bank;

use Illuminate\Support\Str;

final class MockBank implements BankGateway
{
    public function name(): string
    {
        return 'mock';
    }

    public function balance(array $account): ?float
    {
        return isset($account['balance']) ? (float) $account['balance'] : null;
    }

    public function transfer(array $account, array $payee, float $amount, string $reference, string $narration): TransferResult
    {
        if ($amount <= 0) {
            return TransferResult::failed('The amount must be more than zero.');
        }

        if (($payee['account_number'] ?? '') === '' || ($payee['ifsc_code'] ?? '') === '') {
            return TransferResult::failed('The employee has no account number or IFSC.');
        }

        $failOn = (string) config('services.bank.mock_fail_ifsc', '');

        if ($failOn !== '' && strcasecmp((string) $payee['ifsc_code'], $failOn) === 0) {
            return TransferResult::failed('The bank rejected it — the account details did not match.');
        }

        $balance = $this->balance($account);

        if ($balance !== null && $balance < $amount) {
            return TransferResult::failed('The company account is short of funds.');
        }

        $utr = 'MOCK' . Str::upper(Str::random(12));

        return config('services.bank.mock_pending') === true
            ? TransferResult::queued($utr)
            : TransferResult::done($utr);
    }
}

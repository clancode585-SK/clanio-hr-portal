<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\BankTransaction;
use App\Models\CompanyBankAccount;
use App\Models\EmployeeBankAccount;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryDisbursement;
use App\Models\User;
use App\Support\Bank\BankManager;
use App\Support\NotificationType;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SalaryDisbursementService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function quote(PayrollItem $item, ?int $fromAccountId = null): array
    {
        $item->loadMissing('lines', 'run');

        $run = $item->run;
        $from = $this->sourceAccount((int) $item->company_id, $fromAccountId);
        $payee = $this->payeeAccount($item);

        $blockers = [];

        if ($run === null || ! $run->isPayable()) {
            $blockers[] = 'Payroll approve nahi hua hai.';
        }

        if ($item->isPaid()) {
            $blockers[] = 'Is mahine ki salary already ja chuki hai.';
        }

        if ($item->isOnHold()) {
            $blockers[] = 'Ye payslip hold par hai' . ($item->hold_reason ? ' — ' . $item->hold_reason : '') . '.';
        }

        if ((float) $item->net_payable <= 0) {
            $blockers[] = 'Net amount zero hai.';
        }

        if ($payee === null) {
            $blockers[] = 'Employee ka bank account nahi hai. Usse profile me daalne ko bolo.';
        }

        if ($from !== null && (float) $from->balance < (float) $item->net_payable) {
            $blockers[] = 'Company account me paisa kam hai — balance ₹'
                . number_format((float) $from->balance, 2) . '.';
        }

        return [
            'payslip' => $item,
            'from' => $from,
            'to' => $payee === null ? null : [
                'account_holder_name' => $payee->account_holder_name,
                'bank_name' => $payee->bank_name,
                'account_number' => $payee->account_number,
                'masked' => $this->mask((string) $payee->account_number),
                'ifsc_code' => $payee->ifsc_code,
            ],
            'amount' => (float) $item->net_payable,
            'provider' => BankManager::driver()->name(),
            'is_mock' => BankManager::isMock(),
            'can_transfer' => $blockers === [],
            'blockers' => $blockers,
        ];
    }

    public function transferOne(PayrollItem $item, User $actor, ?int $fromAccountId = null): SalaryDisbursement
    {
        $quote = $this->quote($item, $fromAccountId);

        if (! $quote['can_transfer']) {
            throw new ApiException(implode(' ', $quote['blockers']), 422, 'TRANSFER_BLOCKED');
        }

        $disbursement = $this->push($item, $quote['from'], $actor, SalaryDisbursement::MANUAL);

        $this->retotal($item->run);

        return $disbursement;
    }

    public function transferRun(PayrollRun $run, User $actor, ?int $fromAccountId = null, string $mode = SalaryDisbursement::BULK): array
    {
        if (! $run->isPayable()) {
            throw new ApiException(
                $run->isCalculated()
                    ? 'Pehle payroll approve karo, phir salary jaayegi.'
                    : 'Ye payroll ' . $run->statusLabel() . ' hai.',
                409,
                'PAYROLL_NOT_APPROVED'
            );
        }

        $from = $this->sourceAccount((int) $run->company_id, $fromAccountId);

        if ($from === null) {
            throw new ApiException(
                'Pehle company ka bank account add karo — usi se salary jaayegi.',
                422,
                'COMPANY_ACCOUNT_MISSING'
            );
        }

        $items = PayrollItem::query()
            ->with('lines')
            ->where('run_id', $run->id)
            ->whereIn('payment_status', [PayrollItem::PENDING, PayrollItem::FAILED])
            ->where('net_payable', '>', 0)
            ->orderBy('employee_code')
            ->get();

        $sent = 0;
        $failed = 0;
        $amount = 0.0;
        $reasons = [];

        foreach ($items as $item) {
            $item->setRelation('run', $run);

            try {
                $disbursement = $this->push($item, $from->refresh(), $actor, $mode);
            } catch (ApiException $error) {
                $failed++;
                $reasons[$item->employee_code] = $error->getMessage();

                continue;
            }

            if ($disbursement->isSuccess()) {
                $sent++;
                $amount += (float) $disbursement->amount;
            } else {
                $failed++;
                $reasons[$item->employee_code] = $disbursement->failure_reason ?? 'Bank ne mana kiya.';
            }
        }

        $this->retotal($run);

        $skipped = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('payment_status', PayrollItem::ON_HOLD)
            ->count();

        return [
            'run' => $run->refresh(),
            'attempted' => $items->count(),
            'sent' => $sent,
            'failed' => $failed,
            'skipped_on_hold' => $skipped,
            'amount_sent' => round($amount, 2),
            'failures' => $reasons,
        ];
    }

    public function statement(CompanyBankAccount $account, int $perPage = 50)
    {
        return BankTransaction::query()
            ->where('account_id', $account->id)
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function topUp(CompanyBankAccount $account, float $amount, User $actor, ?string $narration = null): CompanyBankAccount
    {
        if (! BankManager::isMock()) {
            throw new ApiException(
                'Balance sirf test wale mock bank me daala ja sakta hai.',
                422,
                'TOPUP_NOT_ALLOWED'
            );
        }

        if ($amount <= 0) {
            throw new ApiException('Amount zero se zyada hona chahiye.', 422, 'AMOUNT_INVALID');
        }

        return DB::transaction(function () use ($account, $amount, $actor, $narration): CompanyBankAccount {
            $balance = round((float) $account->balance + $amount, 2);

            $account->forceFill([
                'balance' => $balance,
                'balance_synced_at' => Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $this->ledger(
                $account,
                null,
                BankTransaction::CREDIT,
                $amount,
                $balance,
                $narration ?: 'Test top-up',
                null,
                $actor
            );

            return $account->refresh();
        });
    }

    private function push(PayrollItem $item, ?CompanyBankAccount $from, User $actor, string $mode): SalaryDisbursement
    {
        if ($from === null) {
            throw new ApiException('Company ka bank account nahi mila.', 422, 'COMPANY_ACCOUNT_MISSING');
        }

        $payee = $this->payeeAccount($item);

        if ($payee === null) {
            throw new ApiException(
                $item->employee_name . ' ka bank account nahi hai.',
                422,
                'EMPLOYEE_ACCOUNT_MISSING'
            );
        }

        $amount = round((float) $item->net_payable, 2);
        $reference = $this->reference($item);
        $gateway = BankManager::driver();

        $disbursement = DB::transaction(function () use ($item, $from, $payee, $amount, $reference, $actor, $mode, $gateway): SalaryDisbursement {
            $row = new SalaryDisbursement();
            $row->company_id = $item->company_id;
            $row->run_id = $item->run_id;
            $row->item_id = $item->id;
            $row->employee_id = $item->employee_id;
            $row->from_account_id = $from->id;
            $row->created_by = $actor->id;

            $row->forceFill([
                'employee_code' => $item->employee_code,
                'employee_name' => $item->employee_name,
                'to_account_holder' => $payee->account_holder_name,
                'to_bank_name' => $payee->bank_name,
                'to_account_number' => $payee->account_number,
                'to_ifsc_code' => $payee->ifsc_code,
                'amount' => $amount,
                'provider' => $gateway->name(),
                'mode' => $mode,
                'reference' => $reference,
                'status' => SalaryDisbursement::PROCESSING,
                'initiated_at' => Carbon::now(),
                'initiated_by' => $actor->id,
            ])->save();

            $item->forceFill([
                'payment_status' => PayrollItem::PROCESSING,
                'updated_by' => $actor->id,
            ])->save();

            return $row;
        });

        $narration = 'Salary ' . ($item->run?->month ?? '') . ' ' . $item->employee_code;

        $result = $gateway->transfer(
            [
                'account_number' => $from->account_number,
                'ifsc_code' => $from->ifsc_code,
                'balance' => $from->balance,
            ],
            [
                'account_holder_name' => $payee->account_holder_name,
                'account_number' => $payee->account_number,
                'ifsc_code' => $payee->ifsc_code,
            ],
            $amount,
            $reference,
            $narration
        );

        return DB::transaction(function () use ($disbursement, $item, $from, $result, $amount, $reference, $narration, $actor): SalaryDisbursement {
            if (! $result->ok) {
                $disbursement->forceFill([
                    'status' => SalaryDisbursement::FAILED,
                    'failure_reason' => $result->reason,
                    'completed_at' => Carbon::now(),
                    'updated_by' => $actor->id,
                ])->save();

                $item->forceFill([
                    'payment_status' => PayrollItem::FAILED,
                    'updated_by' => $actor->id,
                ])->save();

                $this->tellEmployee($item, false, $result->reason, $actor);

                return $disbursement->refresh();
            }

            $balance = round((float) $from->balance - $amount, 2);

            $from->forceFill([
                'balance' => $balance,
                'balance_synced_at' => Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $this->ledger(
                $from,
                $disbursement,
                BankTransaction::DEBIT,
                $amount,
                $balance,
                $narration . ' — ' . $item->employee_name,
                $reference,
                $actor
            );

            $disbursement->forceFill([
                'status' => $result->pending ? SalaryDisbursement::PROCESSING : SalaryDisbursement::SUCCESS,
                'utr' => $result->utr,
                'completed_at' => $result->pending ? null : Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $item->forceFill([
                'payment_status' => $result->pending ? PayrollItem::PROCESSING : PayrollItem::PAID,
                'updated_by' => $actor->id,
            ])->save();

            if (! $result->pending) {
                $this->tellEmployee($item, true, null, $actor);
            }

            return $disbursement->refresh();
        });
    }

    private function retotal(?PayrollRun $run): void
    {
        if ($run === null) {
            return;
        }

        $sums = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('payment_status', PayrollItem::PAID)
            ->selectRaw('COUNT(*) as paid_count, SUM(net_payable) as paid_amount')
            ->first();

        $paidCount = (int) ($sums->paid_count ?? 0);

        $pending = PayrollItem::query()
            ->where('run_id', $run->id)
            ->whereIn('payment_status', [PayrollItem::PENDING, PayrollItem::PROCESSING, PayrollItem::FAILED])
            ->where('net_payable', '>', 0)
            ->exists();

        $run->forceFill([
            'paid_count' => $paidCount,
            'paid_amount' => round((float) ($sums->paid_amount ?? 0), 2),
            'status' => $paidCount > 0 && ! $pending ? PayrollRun::PAID : $run->status,
            'closed_at' => $paidCount > 0 && ! $pending ? Carbon::now() : $run->closed_at,
        ])->save();

        TenantCache::flush(TenantCache::EMPLOYEES);
    }

    private function sourceAccount(int $companyId, ?int $accountId): ?CompanyBankAccount
    {
        return CompanyBankAccount::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->when($accountId !== null, fn ($query) => $query->whereKey($accountId))
            ->orderByDesc('is_primary')
            ->orderBy('id')
            ->first();
    }

    private function payeeAccount(PayrollItem $item): ?EmployeeBankAccount
    {
        return EmployeeBankAccount::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('employee_id', $item->employee_id)
            ->where('is_active', 1)
            ->orderByDesc('is_primary')
            ->orderBy('id')
            ->first();
    }

    private function ledger(
        CompanyBankAccount $account,
        ?SalaryDisbursement $disbursement,
        string $direction,
        float $amount,
        float $balanceAfter,
        string $narration,
        ?string $reference,
        User $actor
    ): void {
        $row = new BankTransaction([
            'direction' => $direction,
            'amount' => $amount,
            'balance_after' => $balanceAfter,
            'narration' => $narration,
            'reference' => $reference,
            'happened_at' => Carbon::now(),
        ]);

        $row->company_id = $account->company_id;
        $row->account_id = $account->id;
        $row->disbursement_id = $disbursement?->id;
        $row->created_by = $actor->id;
        $row->save();
    }

    private function reference(PayrollItem $item): string
    {
        return 'SAL-' . ($item->run?->month ?? 'XXXX-XX') . '-' . $item->employee_code
            . '-' . Str::upper(Str::random(5));
    }

    private function tellEmployee(PayrollItem $item, bool $ok, ?string $reason, User $actor): void
    {
        $userId = DB::table('employees')->where('id', $item->employee_id)->value('user_id');

        if ($userId === null) {
            return;
        }

        $month = $item->run?->monthLabel() ?? '';

        $this->notifications->send((int) $userId, [
            'type' => $ok ? NotificationType::SALARY_PAID : NotificationType::SALARY_FAILED,
            'title' => $ok
                ? $month . ' ki salary aa gayi'
                : $month . ' ki salary transfer nahi ho payi',
            'body' => $ok
                ? '₹' . number_format((float) $item->net_payable, 2) . ' aapke bank account me bhej diya gaya.'
                : ($reason ?? 'Bank ne mana kiya.') . ' HR dekh raha hai.',
            'action_url' => '/my-payslips',
            'entity_type' => 'payroll_item',
            'entity_id' => $item->id,
        ], $actor);
    }

    private function mask(string $number): string
    {
        return strlen($number) <= 4
            ? $number
            : str_repeat('•', max(strlen($number) - 4, 2)) . substr($number, -4);
    }
}

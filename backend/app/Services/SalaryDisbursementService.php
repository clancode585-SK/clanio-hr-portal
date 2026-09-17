<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\BankTransaction;
use App\Models\CompanyBankAccount;
use App\Models\EmployeeBankAccount;
use App\Models\FnfSettlement;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryAdvance;
use App\Models\SalaryDisbursement;
use App\Models\User;
use App\Support\Bank\BankManager;
use App\Support\CompanyTime;
use App\Support\NotificationType;
use App\Support\SalarySeal;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use App\Support\TransferWindow;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SalaryDisbursementService
{
    private const BULK_CHUNK = 200;

    public function __construct(private readonly NotificationService $notifications) {}

    public function quote(PayrollItem $item, ?int $fromAccountId = null, ?User $actor = null): array
    {
        $item->loadMissing('lines', 'run');

        $run = $item->run;
        $from = $this->sourceAccount((int) $item->company_id, $fromAccountId);
        $payee = $this->payeeAccount((int) $item->employee_id);

        $blockers = [];

        if ($run === null || ! $run->isPayable()) {
            $blockers[] = 'Payroll approve nahi hua hai.';
        }

        if (! $item->isApproved()) {
            $blockers[] = 'Is employee ki salary par final approval nahi hui.';
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

        if (! SalarySeal::holds($item->fingerprint, SalarySeal::forItem($item))) {
            $blockers[] = 'Approval ke baad amount badal gaya hai — dobara approve karna padega.';
        }

        if ($run !== null && ! TransferWindow::isOpen($run)) {
            $when = TransferWindow::opensAt($run)->format('d M Y, g:i A');

            $blockers[] = $this->canSendEarly($actor, (int) $item->company_id)
                ? null
                : 'Transfer ' . $when . ' se pehle nahi hoga.';
        }

        if ($payee === null) {
            $blockers[] = 'Employee ka bank account nahi hai. Usse profile me daalne ko bolo.';
        }

        if ($from !== null && (float) $from->balance < (float) $item->net_payable) {
            $blockers[] = 'Company account me paisa kam hai — balance ₹'
                . number_format((float) $from->balance, 2) . '.';
        }

        $blockers = array_values(array_filter($blockers));

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
            'window' => $run === null ? null : TransferWindow::describe($run),
            'sending_early' => $run !== null && ! TransferWindow::isOpen($run),
            'can_transfer' => $blockers === [],
            'blockers' => $blockers,
        ];
    }

    public function transferOne(PayrollItem $item, User $actor, ?int $fromAccountId = null): SalaryDisbursement
    {
        $quote = $this->quote($item, $fromAccountId, $actor);

        if (! $quote['can_transfer']) {
            throw new ApiException(implode(' ', $quote['blockers']), 422, 'TRANSFER_BLOCKED');
        }

        $disbursement = $this->push($item, $quote['from'], $actor, SalaryDisbursement::MANUAL);

        $this->retotal($item->run);

        return $disbursement;
    }

    public function scheduleRun(PayrollRun $run, Carbon $when, ?string $note, User $actor): PayrollRun
    {
        if (! $run->isApproved()) {
            throw new ApiException(
                'Pehle payroll approve karo, phir date set karo.',
                409,
                'PAYROLL_NOT_APPROVED'
            );
        }

        $now = CompanyTime::now((int) $run->company_id);

        if ($when->lessThan($now->copy()->subMinutes(5))) {
            throw new ApiException('Guzar chuki date par schedule nahi hota.', 422, 'SCHEDULE_IN_PAST');
        }

        if ($when->greaterThan($now->copy()->addDays(60))) {
            throw new ApiException('Itni door ki date par schedule nahi hota.', 422, 'SCHEDULE_TOO_FAR');
        }

        if ($when->lessThan(TransferWindow::payMoment($run)) && ! $this->canSendEarly($actor, (int) $run->company_id)) {
            throw new ApiException(
                'Pay date se pehle bhejne ka haq aapke paas nahi hai.',
                403,
                'EARLY_NOT_ALLOWED'
            );
        }

        $run->forceFill([
            'transfer_scheduled_at' => $when->copy()->utc(),
            'transfer_scheduled_by' => $actor->id,
            'schedule_note' => $note,
            'updated_by' => $actor->id,
        ])->save();

        TenantCache::flush(TenantCache::EMPLOYEES);

        return $run->refresh();
    }

    public function cancelSchedule(PayrollRun $run, User $actor): PayrollRun
    {
        $run->forceFill([
            'transfer_scheduled_at' => null,
            'transfer_scheduled_by' => null,
            'schedule_note' => null,
            'updated_by' => $actor->id,
        ])->save();

        TenantCache::flush(TenantCache::EMPLOYEES);

        return $run->refresh();
    }

    public function runQuote(PayrollRun $run, ?int $fromAccountId, ?User $actor): array
    {
        $from = $this->sourceAccount((int) $run->company_id, $fromAccountId);

        $ready = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('approval_status', PayrollItem::APPROVED)
            ->whereIn('payment_status', [PayrollItem::PENDING, PayrollItem::FAILED])
            ->where('net_payable', '>', 0)
            ->selectRaw('COUNT(*) as headcount, SUM(net_payable) as amount')
            ->first();

        $readyCount = (int) ($ready->headcount ?? 0);

        $waiting = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('approval_status', PayrollItem::PENDING)
            ->where('payment_status', '!=', PayrollItem::ON_HOLD)
            ->count();

        $stopped = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('payment_status', PayrollItem::ON_HOLD)
            ->count();

        $amount = round((float) ($ready->amount ?? 0), 2);
        $blockers = [];

        if (! $run->isPayable()) {
            $blockers[] = $run->isCalculated()
                ? 'Pehle payroll approve karo, phir salary jaayegi.'
                : 'Ye payroll ' . $run->statusLabel() . ' hai.';
        }

        if ($readyCount === 0) {
            $blockers[] = 'Bhejne ke liye koi approved salary nahi hai.';
        }

        if ($from === null) {
            $blockers[] = 'Pehle company ka bank account add karo — usi se salary jaayegi.';
        } elseif ((float) $from->balance < $amount) {
            $blockers[] = 'Company account me paisa kam hai — balance ₹'
                . number_format((float) $from->balance, 2) . ', chahiye ₹' . number_format($amount, 2) . '.';
        }

        if (! TransferWindow::isOpen($run) && ! $this->canSendEarly($actor, (int) $run->company_id)) {
            $blockers[] = 'Transfer ' . TransferWindow::opensAt($run)->format('d M Y, g:i A') . ' se pehle nahi hoga.';
        }

        return [
            'from' => $from,
            'headcount' => $readyCount,
            'amount' => $amount,
            'waiting_for_approval' => $waiting,
            'stopped' => $stopped,
            'provider' => BankManager::driver()->name(),
            'is_mock' => BankManager::isMock(),
            'window' => TransferWindow::describe($run),
            'sending_early' => ! TransferWindow::isOpen($run),
            'can_transfer' => $blockers === [],
            'blockers' => $blockers,
        ];
    }

    private function canSendEarly(?User $actor, int $companyId): bool
    {
        if (! TransferWindow::earlyBlocked($companyId)) {
            return true;
        }

        if ($actor === null) {
            return false;
        }

        return $actor->isSuperAdmin() || $actor->hasPermission(SalaryDisbursement::EARLY_PERMISSION);
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

        if (! TransferWindow::isOpen($run) && ! $this->canSendEarly($actor, (int) $run->company_id)) {
            throw new ApiException(
                'Transfer ' . TransferWindow::opensAt($run)->format('d M Y, g:i A') . ' se pehle nahi hoga.',
                409,
                'TRANSFER_WINDOW_CLOSED'
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

        $attempted = 0;
        $sent = 0;
        $failed = 0;
        $amount = 0.0;
        $reasons = [];

        PayrollItem::query()
            ->with('lines')
            ->where('run_id', $run->id)
            ->where('approval_status', PayrollItem::APPROVED)
            ->whereIn('payment_status', [PayrollItem::PENDING, PayrollItem::FAILED])
            ->where('net_payable', '>', 0)
            ->orderBy('id')
            ->chunkById(self::BULK_CHUNK, function ($items) use (
                $run, $from, $actor, $mode, &$attempted, &$sent, &$failed, &$amount, &$reasons
            ): void {
                foreach ($items as $item) {
                    $attempted++;
                    $item->setRelation('run', $run);

                    if (! SalarySeal::holds($item->fingerprint, SalarySeal::forItem($item))) {
                        $failed++;
                        $reasons[$item->employee_code] = 'Approval ke baad amount badal gaya — skip kiya.';

                        continue;
                    }

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
            });

        $this->retotal($run);

        $skipped = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('payment_status', PayrollItem::ON_HOLD)
            ->count();

        $waiting = PayrollItem::query()
            ->where('run_id', $run->id)
            ->where('approval_status', PayrollItem::PENDING)
            ->where('payment_status', '!=', PayrollItem::ON_HOLD)
            ->count();

        return [
            'run' => $run->refresh(),
            'attempted' => $attempted,
            'sent' => $sent,
            'failed' => $failed,
            'skipped_on_hold' => $skipped,
            'skipped_unapproved' => $waiting,
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

    public function quoteSettlement(FnfSettlement $settlement, ?int $fromAccountId = null): array
    {
        $from = $this->sourceAccount((int) $settlement->company_id, $fromAccountId);
        $payee = $this->payeeAccount((int) $settlement->employee_id);
        $amount = round((float) $settlement->net_payable, 2);

        $blockers = [];

        if (! $settlement->isApproved()) {
            $blockers[] = $settlement->status === FnfSettlement::SETTLED
                ? 'Ye settlement already settle ho chuka hai.'
                : 'Settlement approve nahi hua hai.';
        }

        if ($settlement->owesCompany()) {
            $blockers[] = 'Is settlement me employee par ₹' . number_format(abs($amount), 2)
                . ' baaki hai — paisa bhejna nahi hai, lena hai.';
        } elseif ($amount <= 0) {
            $blockers[] = 'Net amount zero hai.';
        }

        if ($settlement->payment_status === FnfSettlement::PAID) {
            $blockers[] = 'Paisa already ja chuka hai.';
        }

        if ($settlement->payment_status === FnfSettlement::ON_HOLD) {
            $blockers[] = 'Ye settlement stop par hai'
                . ($settlement->hold_reason ? ' — ' . $settlement->hold_reason : '') . '.';
        }

        if (! SalarySeal::holds($settlement->fingerprint, SalarySeal::forSettlement($settlement->loadMissing('lines')))) {
            $blockers[] = 'Approval ke baad amount badal gaya hai — dobara approve karna padega.';
        }

        if ($payee === null) {
            $blockers[] = $settlement->employee_name . ' ka bank account nahi hai.';
        }

        if ($from !== null && (float) $from->balance < $amount) {
            $blockers[] = 'Company account me paisa kam hai — balance ₹'
                . number_format((float) $from->balance, 2) . '.';
        }

        return [
            'settlement' => $settlement,
            'from' => $from,
            'to' => $payee === null ? null : [
                'account_holder_name' => $payee->account_holder_name,
                'bank_name' => $payee->bank_name,
                'account_number' => $payee->account_number,
                'masked' => $this->mask((string) $payee->account_number),
                'ifsc_code' => $payee->ifsc_code,
            ],
            'amount' => $amount,
            'provider' => BankManager::driver()->name(),
            'is_mock' => BankManager::isMock(),
            'can_transfer' => $blockers === [],
            'blockers' => $blockers,
        ];
    }

    public function transferSettlement(FnfSettlement $settlement, User $actor, ?int $fromAccountId = null): SalaryDisbursement
    {
        $quote = $this->quoteSettlement($settlement, $fromAccountId);

        if (! $quote['can_transfer']) {
            throw new ApiException(implode(' ', $quote['blockers']), 422, 'TRANSFER_BLOCKED');
        }

        return $this->pushSettlement($settlement, $quote['from'], $actor);
    }

    private function pushSettlement(FnfSettlement $settlement, ?CompanyBankAccount $from, User $actor): SalaryDisbursement
    {
        if ($from === null) {
            throw new ApiException('Company ka bank account nahi mila.', 422, 'COMPANY_ACCOUNT_MISSING');
        }

        $payee = $this->payeeAccount((int) $settlement->employee_id);

        if ($payee === null) {
            throw new ApiException(
                $settlement->employee_name . ' ka bank account nahi hai.',
                422,
                'EMPLOYEE_ACCOUNT_MISSING'
            );
        }

        $amount = round((float) $settlement->net_payable, 2);
        $reference = 'FNF-' . $settlement->employee_code . '-' . Str::upper(Str::random(5));
        $narration = 'Full and final ' . $settlement->employee_code;
        $gateway = BankManager::driver();

        $disbursement = DB::transaction(function () use ($settlement, $from, $payee, $amount, $reference, $actor, $gateway): SalaryDisbursement {
            $row = new SalaryDisbursement();
            $row->company_id = $settlement->company_id;
            $row->settlement_id = $settlement->id;
            $row->employee_id = $settlement->employee_id;
            $row->from_account_id = $from->id;
            $row->created_by = $actor->id;

            $row->forceFill([
                'purpose' => SalaryDisbursement::SETTLEMENT,
                'employee_code' => $settlement->employee_code,
                'employee_name' => $settlement->employee_name,
                'to_account_holder' => $payee->account_holder_name,
                'to_bank_name' => $payee->bank_name,
                'to_account_number' => $payee->account_number,
                'to_ifsc_code' => $payee->ifsc_code,
                'amount' => $amount,
                'provider' => $gateway->name(),
                'mode' => SalaryDisbursement::MANUAL,
                'reference' => $reference,
                'status' => SalaryDisbursement::PROCESSING,
                'initiated_at' => Carbon::now(),
                'initiated_by' => $actor->id,
            ])->save();

            $settlement->forceFill([
                'payment_status' => FnfSettlement::PROCESSING,
                'updated_by' => $actor->id,
            ])->save();

            return $row;
        });

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

        return DB::transaction(function () use ($disbursement, $settlement, $from, $result, $amount, $reference, $narration, $actor): SalaryDisbursement {
            if (! $result->ok) {
                $disbursement->forceFill([
                    'status' => SalaryDisbursement::FAILED,
                    'failure_reason' => $result->reason,
                    'completed_at' => Carbon::now(),
                    'updated_by' => $actor->id,
                ])->save();

                $settlement->forceFill([
                    'payment_status' => FnfSettlement::FAILED,
                    'updated_by' => $actor->id,
                ])->save();

                $this->tellSettled($settlement, false, $result->reason, $actor);

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
                $narration . ' — ' . $settlement->employee_name,
                $reference,
                $actor
            );

            $disbursement->forceFill([
                'status' => $result->pending ? SalaryDisbursement::PROCESSING : SalaryDisbursement::SUCCESS,
                'utr' => $result->utr,
                'completed_at' => $result->pending ? null : Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $settlement->forceFill([
                'payment_status' => $result->pending ? FnfSettlement::PROCESSING : FnfSettlement::PAID,
                'status' => $result->pending ? $settlement->status : FnfSettlement::SETTLED,
                'settled_at' => $result->pending ? null : Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            if (! $result->pending) {
                $this->tellSettled($settlement, true, null, $actor);
            }

            return $disbursement->refresh();
        });
    }

    private function tellSettled(FnfSettlement $settlement, bool $ok, ?string $reason, User $actor): void
    {
        $userId = DB::table('employees')->where('id', $settlement->employee_id)->value('user_id');

        if ($userId === null) {
            return;
        }

        $this->notifications->send((int) $userId, [
            'type' => $ok ? NotificationType::FNF_PAID : NotificationType::SALARY_FAILED,
            'title' => $ok
                ? 'Full and final settle ho gaya'
                : 'Full and final transfer nahi ho paya',
            'body' => $ok
                ? '₹' . number_format((float) $settlement->net_payable, 2) . ' aapke bank account me bhej diya gaya.'
                : ($reason ?? 'Bank ne mana kiya.') . ' HR dekh raha hai.',
            'action_url' => '/my-payslips',
            'entity_type' => 'fnf_settlement',
            'entity_id' => $settlement->id,
        ], $actor);
    }

    private function push(PayrollItem $item, ?CompanyBankAccount $from, User $actor, string $mode): SalaryDisbursement
    {
        if ($from === null) {
            throw new ApiException('Company ka bank account nahi mila.', 422, 'COMPANY_ACCOUNT_MISSING');
        }

        $payee = $this->payeeAccount((int) $item->employee_id);

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
            $current = PayrollItem::query()
                ->withoutGlobalScopes()
                ->whereKey($item->id)
                ->lockForUpdate()
                ->first(['id', 'payment_status', 'approval_status', 'net_payable']);

            if ($current === null || $current->payment_status !== PayrollItem::PENDING && $current->payment_status !== PayrollItem::FAILED) {
                throw new ApiException(
                    $item->employee_name . ' ki salary abhi ' . ($current?->paymentLabel() ?? 'unknown') . ' hai.',
                    409,
                    'ALREADY_IN_FLIGHT'
                );
            }

            if ($current->approval_status !== PayrollItem::APPROVED) {
                throw new ApiException(
                    $item->employee_name . ' ki salary approve nahi hui.',
                    409,
                    'ITEM_NOT_APPROVED'
                );
            }

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

    public function quoteAdvance(SalaryAdvance $advance, ?int $fromAccountId = null): array
    {
        $from = $this->sourceAccount((int) $advance->company_id, $fromAccountId);
        $payee = $this->payeeAccount((int) $advance->employee_id);
        $amount = round((float) $advance->amount, 2);

        $blockers = [];

        if (! $advance->isApproved()) {
            $blockers[] = $advance->isDisbursed()
                ? 'Ye advance already transfer ho chuka hai.'
                : 'Advance approve nahi hua hai.';
        }

        if ($amount <= 0) {
            $blockers[] = 'Amount zero hai.';
        }

        if ($advance->payment_status === SalaryAdvance::PAY_PAID) {
            $blockers[] = 'Paisa already ja chuka hai.';
        }

        if ($advance->payment_status === SalaryAdvance::ON_HOLD) {
            $blockers[] = 'Ye advance stop par hai'
                . ($advance->hold_reason ? ' — ' . $advance->hold_reason : '') . '.';
        }

        if ($payee === null) {
            $blockers[] = $advance->employee_name . ' ka bank account nahi hai.';
        }

        if ($from !== null && (float) $from->balance < $amount) {
            $blockers[] = 'Company account me paisa kam hai — balance ₹'
                . number_format((float) $from->balance, 2) . '.';
        }

        return [
            'advance' => $advance,
            'from' => $from,
            'to' => $payee === null ? null : [
                'account_holder_name' => $payee->account_holder_name,
                'bank_name' => $payee->bank_name,
                'account_number' => $payee->account_number,
                'masked' => $this->mask((string) $payee->account_number),
                'ifsc_code' => $payee->ifsc_code,
            ],
            'amount' => $amount,
            'provider' => BankManager::driver()->name(),
            'is_mock' => BankManager::isMock(),
            'can_transfer' => $blockers === [],
            'blockers' => $blockers,
        ];
    }

    public function transferAdvance(SalaryAdvance $advance, User $actor, ?int $fromAccountId = null): SalaryDisbursement
    {
        $quote = $this->quoteAdvance($advance, $fromAccountId);

        if (! $quote['can_transfer']) {
            throw new ApiException(implode(' ', $quote['blockers']), 422, 'TRANSFER_BLOCKED');
        }

        $from = $quote['from'];

        if ($from === null) {
            throw new ApiException('Company ka bank account nahi mila.', 422, 'COMPANY_ACCOUNT_MISSING');
        }

        $payee = $this->payeeAccount((int) $advance->employee_id);
        $amount = round((float) $advance->amount, 2);
        $reference = 'ADV-' . $advance->employee_code . '-' . Str::upper(Str::random(5));
        $narration = 'Salary advance ' . $advance->reference;
        $gateway = BankManager::driver();

        $disbursement = DB::transaction(function () use ($advance, $from, $payee, $amount, $reference, $actor, $gateway): SalaryDisbursement {
            $row = new SalaryDisbursement();
            $row->company_id = $advance->company_id;
            $row->employee_id = $advance->employee_id;
            $row->from_account_id = $from->id;
            $row->created_by = $actor->id;

            $row->forceFill([
                'advance_id' => $advance->id,
                'purpose' => SalaryDisbursement::ADVANCE,
                'employee_code' => $advance->employee_code,
                'employee_name' => $advance->employee_name,
                'to_account_holder' => $payee->account_holder_name,
                'to_bank_name' => $payee->bank_name,
                'to_account_number' => $payee->account_number,
                'to_ifsc_code' => $payee->ifsc_code,
                'amount' => $amount,
                'provider' => $gateway->name(),
                'mode' => SalaryDisbursement::MANUAL,
                'reference' => $reference,
                'status' => SalaryDisbursement::PROCESSING,
                'initiated_at' => Carbon::now(),
                'initiated_by' => $actor->id,
            ])->save();

            $advance->forceFill([
                'payment_status' => SalaryAdvance::PAY_PROCESSING,
                'updated_by' => $actor->id,
            ])->save();

            return $row;
        });

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

        return DB::transaction(function () use ($disbursement, $advance, $from, $result, $amount, $reference, $narration, $actor): SalaryDisbursement {
            if (! $result->ok) {
                $disbursement->forceFill([
                    'status' => SalaryDisbursement::FAILED,
                    'failure_reason' => $result->reason,
                    'completed_at' => Carbon::now(),
                    'updated_by' => $actor->id,
                ])->save();

                $advance->forceFill([
                    'payment_status' => SalaryAdvance::PAY_FAILED,
                    'updated_by' => $actor->id,
                ])->save();

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
                $narration . ' — ' . $advance->employee_name,
                $reference,
                $actor
            );

            $disbursement->forceFill([
                'status' => $result->pending ? SalaryDisbursement::PROCESSING : SalaryDisbursement::SUCCESS,
                'utr' => $result->utr,
                'completed_at' => $result->pending ? null : Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            if ($result->pending) {
                $advance->forceFill(['payment_status' => SalaryAdvance::PAY_PROCESSING])->save();
            } else {
                app(SalaryAdvanceService::class)->markDisbursed($advance, $actor);
            }

            return $disbursement->refresh();
        });
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

    private function payeeAccount(int $employeeId): ?EmployeeBankAccount
    {
        return EmployeeBankAccount::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('employee_id', $employeeId)
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

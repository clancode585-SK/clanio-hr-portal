<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Mail\TransferCodeMail;
use App\Models\Company;
use App\Models\CompanyBankAccount;
use App\Models\SalaryDisbursement;
use App\Models\TransferVerification;
use App\Models\User;
use App\Support\Money;
use App\Support\NotificationType;
use App\Support\Scopes\CompanyScope;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

final class TransferVerificationService
{
    private const MINUTES = 10;

    public function __construct(private readonly NotificationService $notifications) {}

    public function guard(array $subject, ?string $uuid, ?string $code, User $actor): ?TransferVerification
    {
        $company = $this->company((int) $subject['company_id']);

        if (! (bool) $company->transfer_otp_enabled) {
            return null;
        }

        if ($uuid === null || $uuid === '' || $code === null || $code === '') {
            return $this->start($subject, $company, $actor);
        }

        return $this->confirm($subject, $company, $uuid, $code, $actor);
    }

    public function consume(?TransferVerification $verification, User $actor): void
    {
        if ($verification === null) {
            return;
        }

        $verification->forceFill([
            'status' => TransferVerification::CONSUMED,
            'consumed_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();
    }

    public function release(?TransferVerification $verification, User $actor): void
    {
        if ($verification === null || ! $verification->isVerified()) {
            return;
        }

        $verification->forceFill([
            'status' => TransferVerification::PENDING,
            'verified_at' => null,
            'updated_by' => $actor->id,
        ])->save();
    }

    public function describe(TransferVerification $verification): array
    {
        return [
            'uuid' => $verification->uuid,
            'purpose' => $verification->purpose,
            'action' => $verification->action,
            'sent_to' => $verification->sent_masked,
            'channel' => $verification->channel,
            'amount' => (float) $verification->amount,
            'headcount' => (int) $verification->headcount,
            'scheduled_for' => $verification->scheduled_for?->toIso8601String(),
            'minutes_left' => $verification->minutesLeft(),
            'tries_left' => $verification->triesLeft(),
            'status' => $verification->status,
        ];
    }

    private function start(array $subject, Company $company, User $actor): TransferVerification
    {
        TransferVerification::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $company->id)
            ->where('purpose', $subject['purpose'])
            ->where('action', $subject['action'])
            ->where('run_id', $subject['run_id'] ?? null)
            ->where('item_id', $subject['item_id'] ?? null)
            ->where('settlement_id', $subject['settlement_id'] ?? null)
            ->whereIn('status', [TransferVerification::PENDING, TransferVerification::VERIFIED])
            ->update(['status' => TransferVerification::CANCELLED, 'updated_by' => $actor->id]);

        $target = $this->target($company, $actor);
        $code = (string) random_int(100000, 999999);

        $verification = new TransferVerification();
        $verification->company_id = $company->id;
        $verification->created_by = $actor->id;

        $verification->forceFill([
            'purpose' => $subject['purpose'],
            'action' => $subject['action'],
            'run_id' => $subject['run_id'] ?? null,
            'item_id' => $subject['item_id'] ?? null,
            'settlement_id' => $subject['settlement_id'] ?? null,
            'headcount' => (int) ($subject['headcount'] ?? 1),
            'amount' => round((float) $subject['amount'], 2),
            'scheduled_for' => $subject['scheduled_for'] ?? null,
            'code_hash' => hash('sha256', $code),
            'channel' => 'email',
            'sent_to' => $target['email'],
            'sent_masked' => $this->mask($target['email']),
            'expires_at' => Carbon::now()->addMinutes(self::MINUTES),
            'requested_by' => $actor->id,
        ])->save();

        $this->deliver($verification, $code, $target, $actor, (string) ($subject['what'] ?? 'this transfer'));

        return $verification->refresh();
    }

    private function confirm(
        array $subject,
        Company $company,
        string $uuid,
        string $code,
        User $actor
    ): TransferVerification {
        $verification = TransferVerification::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $company->id)
            ->where('uuid', $uuid)
            ->first();

        if ($verification === null) {
            throw new ApiException('Ye code wali request nahi mili. Dobara code mangao.', 404, 'VERIFICATION_NOT_FOUND');
        }

        if (! $verification->matches(
            (string) $subject['purpose'],
            $subject['run_id'] ?? null,
            $subject['item_id'] ?? null,
            $subject['settlement_id'] ?? null,
            (string) $subject['action']
        )) {
            throw new ApiException('Ye code kisi dusri request ka hai.', 422, 'VERIFICATION_MISMATCH');
        }

        if ($verification->status === TransferVerification::CONSUMED) {
            throw new ApiException('Ye code already use ho chuka hai.', 409, 'VERIFICATION_USED');
        }

        if (! $verification->isUsable()) {
            throw new ApiException('Code ka time nikal gaya. Naya code mangao.', 410, 'VERIFICATION_EXPIRED');
        }

        if ($verification->triesLeft() <= 0) {
            $verification->forceFill(['status' => TransferVerification::CANCELLED])->save();

            throw new ApiException('Bahut galat code — request band kar di. Naya code mangao.', 429, 'VERIFICATION_LOCKED');
        }

        if (! hash_equals((string) $verification->code_hash, hash('sha256', trim($code)))) {
            $verification->forceFill(['attempts' => (int) $verification->attempts + 1])->save();

            $left = $verification->refresh()->triesLeft();

            throw new ApiException(
                $left > 0
                    ? 'Code galat hai. ' . $left . ' koshish bachi hai.'
                    : 'Code galat hai aur koshish khatam. Naya code mangao.',
                422,
                'VERIFICATION_WRONG'
            );
        }

        $amount = round((float) $subject['amount'], 2);
        $headcount = (int) ($subject['headcount'] ?? 1);

        if (abs($amount - (float) $verification->amount) > 0.01 || $headcount !== (int) $verification->headcount) {
            $verification->forceFill(['status' => TransferVerification::CANCELLED])->save();

            throw new ApiException(
                'Code mangne ke baad amount badal gaya hai — safety ke liye roka. Dobara code mangao.',
                409,
                'VERIFICATION_STALE'
            );
        }

        $verification->forceFill([
            'status' => TransferVerification::VERIFIED,
            'verified_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        return $verification->refresh();
    }

    private function deliver(
        TransferVerification $verification,
        string $code,
        array $target,
        User $actor,
        string $what
    ): void {
        try {
            Mail::to($target['email'])->send(new TransferCodeMail($verification, $code, $actor->name, $what));
        } catch (\Throwable $error) {
            Log::warning('Transfer code mail failed: ' . $error->getMessage());
        }

        if ($target['user'] === null || (int) $target['user']->id === (int) $actor->id) {
            return;
        }

        $this->notifications->send($target['user'], [
            'type' => NotificationType::TRANSFER_CODE,
            'title' => 'Salary release ka code aapke email par gaya',
            'body' => $actor->name . ' ne ₹' . Money::indian($verification->amount, 2)
                . ' release karne ke liye code manga hai. Code sirf aapke email me hai.',
            'action_url' => '/payroll',
            'entity_type' => 'transfer_verification',
            'entity_id' => $verification->id,
        ], $actor);
    }

    private function target(Company $company, User $actor): array
    {
        if ($company->transfer_otp_to === 'account') {
            $account = CompanyBankAccount::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $company->id)
                ->orderByDesc('is_primary')
                ->orderBy('id')
                ->first();

            $email = $account?->contact_email;

            if ($email !== null && $email !== '') {
                return ['email' => $email, 'user' => null];
            }
        }

        $approver = $this->approver($company, $actor);

        if ($approver !== null) {
            return ['email' => $approver->email, 'user' => $approver];
        }

        if ($company->email !== null && $company->email !== '') {
            return ['email' => $company->email, 'user' => null];
        }

        return ['email' => $actor->email, 'user' => $actor];
    }

    private function approver(Company $company, User $actor): ?User
    {
        $users = User::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $company->id)
            ->where('status', 'active')
            ->get();

        $allowed = $users->filter(
            fn (User $user): bool => $user->isSuperAdmin() || $user->hasPermission(SalaryDisbursement::PERMISSION)
        );

        return $allowed->first(fn (User $user): bool => (int) $user->id !== (int) $actor->id)
            ?? $allowed->first();
    }

    private function company(int $companyId): Company
    {
        $company = Company::query()->withoutGlobalScopes()->find($companyId);

        if ($company === null) {
            throw new ApiException('Company record nahi mila.', 404, 'NOT_FOUND');
        }

        return $company;
    }

    private function mask(string $email): string
    {
        if (! str_contains($email, '@')) {
            return str_repeat('•', max(strlen($email) - 2, 2)) . substr($email, -2);
        }

        [$name, $domain] = explode('@', $email, 2);

        $head = substr($name, 0, 2);
        $tail = strlen($name) > 3 ? substr($name, -1) : '';

        return $head . str_repeat('•', max(strlen($name) - strlen($head) - strlen($tail), 2)) . $tail . '@' . $domain;
    }

    public function sweep(): int
    {
        return DB::table('transfer_verifications')
            ->whereIn('status', [TransferVerification::PENDING, TransferVerification::VERIFIED])
            ->where('expires_at', '<', Carbon::now())
            ->update(['status' => TransferVerification::EXPIRED, 'updated_at' => Carbon::now()]);
    }
}

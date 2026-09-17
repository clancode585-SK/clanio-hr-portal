<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Resources\CompanyBankAccountResource;
use App\Http\Resources\PayrollItemResource;
use App\Http\Resources\PayrollRunResource;
use App\Http\Resources\SalaryDisbursementResource;
use App\Models\CompanyBankAccount;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryDisbursement;
use App\Models\TransferVerification;
use App\Services\SalaryDisbursementService;
use App\Services\TransferVerificationService;
use App\Support\ApiResponse;
use App\Support\Bank\BankManager;
use App\Support\CompanyTime;
use App\Support\TransferWindow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SalaryTransferController extends ApiController
{
    public function __construct(
        private readonly SalaryDisbursementService $transfers,
        private readonly TransferVerificationService $verifications
    ) {}

    public function accounts(): JsonResponse
    {
        $accounts = CompanyBankAccount::query()->orderByDesc('is_primary')->orderBy('id')->get();

        return ApiResponse::success([
            'accounts' => CompanyBankAccountResource::collection($accounts),
            'provider' => BankManager::driver()->name(),
            'is_mock' => BankManager::isMock(),
            'note' => BankManager::isMock()
                ? 'Abhi test wala bank laga hai — asli paisa kahin nahi jaata. .env me BANK_DRIVER badal kar asli bank lagega.'
                : null,
        ], 'Company bank accounts fetched successfully');
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $companyId = $this->companyId();

        $data = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'account_holder_name' => ['required', 'string', 'max:150'],
            'bank_name' => ['required', 'string', 'max:150'],
            'account_number' => ['required', 'string', 'max:30',
                Rule::unique('company_bank_accounts', 'account_number')
                    ->where('company_id', $companyId)
                    ->where('is_active', 1)],
            'ifsc_code' => ['required', 'string', 'regex:/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/'],
            'branch_name' => ['nullable', 'string', 'max:150'],
            'contact_email' => ['nullable', 'email', 'max:150'],
            'is_primary' => ['nullable', 'boolean'],
            'balance' => ['nullable', 'numeric', 'min:0'],
        ], [
            'ifsc_code.regex' => 'IFSC aise hota hai — HDFC0000123.',
            'account_number.unique' => 'Ye account already add hua hai.',
        ]);

        $account = new CompanyBankAccount($data);
        $account->company_id = $companyId;
        $account->provider = BankManager::driver()->name();
        $account->created_by = $request->user()->id;

        if (! CompanyBankAccount::query()->where('company_id', $companyId)->exists()) {
            $account->is_primary = true;
        }

        $account->save();

        $this->keepOnePrimary($account);

        return ApiResponse::created(
            new CompanyBankAccountResource($account->refresh()),
            'Company bank account added successfully'
        );
    }

    public function updateAccount(Request $request, CompanyBankAccount $companyBankAccount): JsonResponse
    {
        $data = $request->validate([
            'label' => ['sometimes', 'string', 'max:100'],
            'account_holder_name' => ['sometimes', 'string', 'max:150'],
            'bank_name' => ['sometimes', 'string', 'max:150'],
            'ifsc_code' => ['sometimes', 'string', 'regex:/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/'],
            'branch_name' => ['nullable', 'string', 'max:150'],
            'contact_email' => ['nullable', 'email', 'max:150'],
            'is_primary' => ['sometimes', 'boolean'],
        ]);

        $companyBankAccount->fill($data);
        $companyBankAccount->updated_by = $request->user()->id;
        $companyBankAccount->save();

        $this->keepOnePrimary($companyBankAccount);

        return ApiResponse::success(
            new CompanyBankAccountResource($companyBankAccount->refresh()),
            'Company bank account updated successfully'
        );
    }

    public function destroyAccount(CompanyBankAccount $companyBankAccount): JsonResponse
    {
        $used = SalaryDisbursement::query()
            ->where('from_account_id', $companyBankAccount->id)
            ->where('status', SalaryDisbursement::SUCCESS)
            ->exists();

        if ($used) {
            throw new ApiException(
                'Is account se salary ja chuki hai — record ke liye ise rakhna padega.',
                409,
                'ACCOUNT_IN_USE'
            );
        }

        $companyBankAccount->deactivate();

        return ApiResponse::success(null, 'Company bank account removed successfully');
    }

    public function topUp(Request $request, CompanyBankAccount $companyBankAccount): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'narration' => ['nullable', 'string', 'max:255'],
        ]);

        return ApiResponse::success(
            new CompanyBankAccountResource(
                $this->transfers->topUp(
                    $companyBankAccount,
                    (float) $data['amount'],
                    $request->user(),
                    $data['narration'] ?? null
                )
            ),
            'Test balance added'
        );
    }

    public function statement(Request $request, CompanyBankAccount $companyBankAccount): JsonResponse
    {
        $rows = $this->transfers->statement($companyBankAccount, $this->perPage($request));

        return ApiResponse::success([
            'account' => new CompanyBankAccountResource($companyBankAccount),
            'transactions' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ], 'Account statement fetched successfully');
    }

    public function quote(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        $quote = $this->transfers->quote($payrollItem, $this->fromAccount($request), $request->user());

        return ApiResponse::success([
            'payslip' => new PayrollItemResource($quote['payslip']),
            'from' => $quote['from'] === null ? null : new CompanyBankAccountResource($quote['from']),
            'to' => $quote['to'],
            'amount' => $quote['amount'],
            'provider' => $quote['provider'],
            'is_mock' => $quote['is_mock'],
            'window' => $quote['window'],
            'sending_early' => $quote['sending_early'],
            'needs_code' => $this->codeNeeded($payrollItem->company_id),
            'can_transfer' => $quote['can_transfer'],
            'blockers' => $quote['blockers'],
        ], 'Transfer details fetched successfully');
    }

    public function runQuote(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $quote = $this->transfers->runQuote($payrollRun, $this->fromAccount($request), $request->user());

        return ApiResponse::success([
            'run' => new PayrollRunResource($payrollRun),
            'from' => $quote['from'] === null ? null : new CompanyBankAccountResource($quote['from']),
            'headcount' => $quote['headcount'],
            'amount' => $quote['amount'],
            'waiting_for_approval' => $quote['waiting_for_approval'],
            'stopped' => $quote['stopped'],
            'provider' => $quote['provider'],
            'is_mock' => $quote['is_mock'],
            'window' => $quote['window'],
            'sending_early' => $quote['sending_early'],
            'needs_code' => $this->codeNeeded($payrollRun->company_id),
            'can_transfer' => $quote['can_transfer'],
            'blockers' => $quote['blockers'],
        ], 'Transfer summary fetched successfully');
    }

    public function transferOne(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        $data = $request->validate($this->codeRules());
        $quote = $this->transfers->quote($payrollItem, $this->fromAccount($request), $request->user());

        if (! $quote['can_transfer']) {
            throw new ApiException(implode(' ', $quote['blockers']), 422, 'TRANSFER_BLOCKED');
        }

        $verification = $this->verifications->guard([
            'company_id' => (int) $payrollItem->company_id,
            'purpose' => TransferVerification::SALARY_ITEM,
            'action' => TransferVerification::TRANSFER,
            'item_id' => (int) $payrollItem->id,
            'run_id' => (int) $payrollItem->run_id,
            'settlement_id' => null,
            'amount' => (float) $payrollItem->net_payable,
            'headcount' => 1,
            'what' => $payrollItem->employee_name . ' ki salary',
        ], $data['verification_uuid'] ?? null, $data['code'] ?? null, $request->user());

        if ($verification !== null && ! $verification->isVerified()) {
            return $this->codeSent($verification, $payrollItem->employee_name . ' ki salary');
        }

        $disbursement = $this->transfers->transferOne($payrollItem, $request->user(), $this->fromAccount($request));

        $this->verifications->consume($verification, $request->user());

        return ApiResponse::success([
            'disbursement' => new SalaryDisbursementResource($disbursement),
            'payslip' => new PayrollItemResource($payrollItem->refresh()->load('lines', 'run')),
        ], $disbursement->isSuccess()
            ? $payrollItem->employee_name . ' ko salary bhej di gayi'
            : 'Transfer fail hua — ' . ($disbursement->failure_reason ?? 'bank ne mana kiya'));
    }

    public function transferRun(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $data = $request->validate($this->codeRules());
        $quote = $this->transfers->runQuote($payrollRun, $this->fromAccount($request), $request->user());

        if (! $quote['can_transfer']) {
            throw new ApiException(implode(' ', $quote['blockers']), 422, 'TRANSFER_BLOCKED');
        }

        $verification = $this->verifications->guard([
            'company_id' => (int) $payrollRun->company_id,
            'purpose' => TransferVerification::SALARY_RUN,
            'action' => TransferVerification::TRANSFER,
            'item_id' => null,
            'run_id' => (int) $payrollRun->id,
            'settlement_id' => null,
            'amount' => (float) $quote['amount'],
            'headcount' => (int) $quote['headcount'],
            'what' => $payrollRun->monthLabel() . ' ki salary',
        ], $data['verification_uuid'] ?? null, $data['code'] ?? null, $request->user());

        if ($verification !== null && ! $verification->isVerified()) {
            return $this->codeSent($verification, $payrollRun->monthLabel() . ' ki salary');
        }

        $result = $this->transfers->transferRun($payrollRun, $request->user(), $this->fromAccount($request));

        $this->verifications->consume($verification, $request->user());

        return ApiResponse::success([
            'run' => new PayrollRunResource($result['run']),
            'attempted' => $result['attempted'],
            'sent' => $result['sent'],
            'failed' => $result['failed'],
            'skipped_on_hold' => $result['skipped_on_hold'],
            'skipped_unapproved' => $result['skipped_unapproved'],
            'amount_sent' => $result['amount_sent'],
            'failures' => $result['failures'],
        ], $result['sent'] . ' salary bhej di gayi'
            . ($result['failed'] > 0 ? ', ' . $result['failed'] . ' fail hui' : '')
            . ($result['skipped_on_hold'] > 0 ? ', ' . $result['skipped_on_hold'] . ' hold par chhod di' : '')
            . ($result['skipped_unapproved'] > 0 ? ', ' . $result['skipped_unapproved'] . ' approve nahi thi' : ''));
    }

    public function schedule(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $data = $request->validate($this->codeRules() + [
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['nullable', 'date_format:H:i'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $when = CompanyTime::at(
            $data['date'],
            ($data['time'] ?? TransferWindow::payTime((int) $payrollRun->company_id)) . ':00',
            (int) $payrollRun->company_id
        );

        $quote = $this->transfers->runQuote($payrollRun, $this->fromAccount($request), $request->user());

        $verification = $this->verifications->guard([
            'company_id' => (int) $payrollRun->company_id,
            'purpose' => TransferVerification::SALARY_RUN,
            'action' => TransferVerification::SCHEDULE,
            'item_id' => null,
            'run_id' => (int) $payrollRun->id,
            'settlement_id' => null,
            'amount' => (float) $quote['amount'],
            'headcount' => (int) $quote['headcount'],
            'scheduled_for' => $when->copy()->utc(),
            'what' => $payrollRun->monthLabel() . ' ki salary',
        ], $data['verification_uuid'] ?? null, $data['code'] ?? null, $request->user());

        if ($verification !== null && ! $verification->isVerified()) {
            return $this->codeSent($verification, $payrollRun->monthLabel() . ' ki salary');
        }

        $run = $this->transfers->scheduleRun($payrollRun, $when, $data['note'] ?? null, $request->user());

        $this->verifications->consume($verification, $request->user());

        return ApiResponse::success(
            new PayrollRunResource($run),
            'Transfer ' . $when->format('d M Y, g:i A') . ' par set kar diya'
        );
    }

    public function scheduleDefaults(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $quote = $this->transfers->runQuote($payrollRun, $this->fromAccount($request), $request->user());
        $suggested = TransferWindow::opensAt($payrollRun);

        return ApiResponse::success([
            'date' => $suggested->format('Y-m-d'),
            'time' => $suggested->format('H:i'),
            'weekday' => $suggested->format('l'),
            'is_sunday' => $suggested->isSunday(),
            'zone' => TransferWindow::describe($payrollRun)['zone'],
            'window' => TransferWindow::describe($payrollRun),
            'headcount' => $quote['headcount'],
            'amount' => $quote['amount'],
            'waiting_for_approval' => $quote['waiting_for_approval'],
            'stopped' => $quote['stopped'],
            'needs_code' => $this->codeNeeded($payrollRun->company_id),
        ], 'Schedule defaults fetched successfully');
    }

    public function cancelSchedule(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        return ApiResponse::success(
            new PayrollRunResource($this->transfers->cancelSchedule($payrollRun, $request->user())),
            'Schedule hata diya'
        );
    }

    public function disbursements(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $rows = SalaryDisbursement::query()
            ->where('run_id', $payrollRun->id)
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($rows, SalaryDisbursementResource::class, 'Transfers fetched successfully');
    }

    private function fromAccount(Request $request): ?int
    {
        return $request->filled('from_account_id') ? (int) $request->input('from_account_id') : null;
    }

    private function codeRules(): array
    {
        return [
            'from_account_id' => ['nullable', 'integer'],
            'verification_uuid' => ['nullable', 'string', 'max:40'],
            'code' => ['nullable', 'string', 'max:10'],
        ];
    }

    private function codeNeeded(int|string|null $companyId): bool
    {
        return (bool) DB::table('companies')->where('id', $companyId)->value('transfer_otp_enabled');
    }

    private function codeSent(TransferVerification $verification, string $what): JsonResponse
    {
        return ApiResponse::success([
            'verification' => $this->verifications->describe($verification),
        ], 'Safety ke liye code ' . $verification->sent_masked . ' par bheja gaya. '
            . $what . ' bhejne ke liye wahi code daalo.', 202);
    }

    private function keepOnePrimary(CompanyBankAccount $account): void
    {
        if (! $account->is_primary) {
            return;
        }

        CompanyBankAccount::query()
            ->where('company_id', $account->company_id)
            ->whereKeyNot($account->id)
            ->update(['is_primary' => false]);
    }

    private function companyId(): int
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'Bank accounts belong to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return $id;
    }
}

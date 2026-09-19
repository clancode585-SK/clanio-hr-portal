<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Resources\CompanyBankAccountResource;
use App\Http\Resources\FnfSettlementResource;
use App\Models\EmployeeExit;
use App\Models\FnfLine;
use App\Models\FnfSettlement;
use App\Models\TransferVerification;
use App\Services\FnfService;
use App\Services\FnfStatementService;
use App\Services\SalaryDisbursementService;
use App\Services\TransferVerificationService;
use App\Support\ApiResponse;
use App\Support\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FnfController extends ApiController
{
    public function __construct(
        private readonly FnfService $fnf,
        private readonly FnfStatementService $statements,
        private readonly SalaryDisbursementService $transfers,
        private readonly TransferVerificationService $verifications
    ) {}

    public function preview(FnfSettlement $fnfSettlement): Response
    {
        return Pdf::show($this->statements->pdf($fnfSettlement), $this->statements->fileName($fnfSettlement));
    }

    public function download(FnfSettlement $fnfSettlement): StreamedResponse
    {
        return Pdf::send($this->statements->pdf($fnfSettlement), $this->statements->fileName($fnfSettlement));
    }

    public function index(Request $request): JsonResponse
    {
        $settlements = FnfSettlement::query()
            ->visibleTo($request->user())
            ->with('lines')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('search'), fn ($query) => $query->where(fn ($inner) => $inner
                ->where('employee_name', 'like', '%' . $request->string('search') . '%')
                ->orWhere('employee_code', 'like', '%' . $request->string('search') . '%')))
            ->orderByDesc('last_working_date')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($settlements, FnfSettlementResource::class, 'Settlements fetched successfully');
    }

    public function pending(): JsonResponse
    {
        return ApiResponse::success(
            $this->fnf->pending($this->companyId()),
            'Exits waiting for a settlement fetched successfully'
        );
    }

    public function show(FnfSettlement $fnfSettlement): JsonResponse
    {
        return ApiResponse::success(
            new FnfSettlementResource($fnfSettlement->load('lines', 'exit', 'approvedBy')),
            'Settlement fetched successfully'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'exit_uuid' => ['required', 'string'],
        ]);

        $exit = EmployeeExit::query()->visibleTo($request->user())
            ->where('uuid', $data['exit_uuid'])
            ->first();

        if ($exit === null) {
            throw new ApiException('Ye exit nahi mila.', 404, 'EXIT_NOT_FOUND');
        }

        return ApiResponse::created(
            new FnfSettlementResource($this->fnf->open($exit, $request->user())->load('lines')),
            'Settlement ban gaya — suggestions dekh lo, phir approve karo'
        );
    }

    public function calculate(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        return ApiResponse::success(
            new FnfSettlementResource($this->fnf->calculate($fnfSettlement, $request->user())->load('lines')),
            'Settlement dobara calculate ho gaya'
        );
    }

    public function applyLine(Request $request, FnfLine $fnfLine): JsonResponse
    {
        $data = $request->validate([
            'is_applied' => ['required', 'boolean'],
            'amount' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
        ]);

        $settlement = $this->fnf->applyLine(
            $fnfLine,
            (bool) $data['is_applied'],
            isset($data['amount']) ? (float) $data['amount'] : null,
            $request->user()
        );

        return ApiResponse::success(
            new FnfSettlementResource($settlement),
            $data['is_applied'] ? 'Line lagaa di gayi' : 'Line hata di gayi'
        );
    }

    public function addLine(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:150'],
            'kind' => ['required', 'string', 'in:' . implode(',', FnfLine::KINDS)],
            'amount' => ['required', 'numeric', 'min:0', 'max:99999999'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        return ApiResponse::created(
            new FnfSettlementResource($this->fnf->addLine($fnfSettlement, $data, $request->user())),
            'Line add ho gayi'
        );
    }

    public function removeLine(Request $request, FnfLine $fnfLine): JsonResponse
    {
        return ApiResponse::success(
            new FnfSettlementResource($this->fnf->removeLine($fnfLine, $request->user())),
            'Line hata di gayi'
        );
    }

    public function approve(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        return ApiResponse::success(
            new FnfSettlementResource($this->fnf->approve($fnfSettlement, $request->user())->load('lines')),
            'Settlement approve ho gaya — ab paisa bheja ja sakta hai'
        );
    }

    public function bulkApprove(Request $request): JsonResponse
    {
        $data = $request->validate([
            'uuids' => ['required', 'array', 'min:1', 'max:500'],
            'uuids.*' => ['string', 'max:40'],
        ]);

        $result = $this->fnf->approveMany($data['uuids'], $request->user());

        return ApiResponse::success($result, $result['approved'] . ' settlement approve ho gaye'
            . (count($result['skipped']) > 0 ? ', ' . count($result['skipped']) . ' chhod diye' : ''));
    }

    public function hold(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        return ApiResponse::success(
            new FnfSettlementResource($this->fnf->hold($fnfSettlement, $data['reason'] ?? null, $request->user())),
            'Settlement stop kar diya'
        );
    }

    public function release(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        return ApiResponse::success(
            new FnfSettlementResource($this->fnf->release($fnfSettlement, $request->user())),
            'Stop hata diya'
        );
    }

    public function cancel(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        return ApiResponse::success(
            new FnfSettlementResource($this->fnf->cancel($fnfSettlement, $request->user())),
            'Settlement cancel ho gaya'
        );
    }

    public function markRecovered(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        return ApiResponse::success(
            new FnfSettlementResource($this->fnf->markRecovered($fnfSettlement, $request->user())),
            'Recovery poori maan li gayi'
        );
    }

    public function quote(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        $quote = $this->transfers->quoteSettlement(
            $fnfSettlement,
            $request->filled('from_account_id') ? (int) $request->input('from_account_id') : null
        );

        return ApiResponse::success([
            'settlement' => new FnfSettlementResource($fnfSettlement->load('lines')),
            'from' => $quote['from'] === null ? null : new CompanyBankAccountResource($quote['from']),
            'to' => $quote['to'],
            'amount' => $quote['amount'],
            'provider' => $quote['provider'],
            'is_mock' => $quote['is_mock'],
            'can_transfer' => $quote['can_transfer'],
            'blockers' => $quote['blockers'],
        ], 'Transfer quote fetched successfully');
    }

    public function transfer(Request $request, FnfSettlement $fnfSettlement): JsonResponse
    {
        $data = $request->validate([
            'from_account_id' => ['nullable', 'integer'],
            'verification_uuid' => ['nullable', 'string', 'max:40'],
            'code' => ['nullable', 'string', 'max:10'],
        ]);

        $quote = $this->transfers->quoteSettlement(
            $fnfSettlement,
            isset($data['from_account_id']) ? (int) $data['from_account_id'] : null
        );

        if (! $quote['can_transfer']) {
            throw new ApiException(implode(' ', $quote['blockers']), 422, 'TRANSFER_BLOCKED');
        }

        $verification = $this->verifications->guard([
            'company_id' => (int) $fnfSettlement->company_id,
            'purpose' => TransferVerification::SETTLEMENT,
            'action' => TransferVerification::TRANSFER,
            'item_id' => null,
            'run_id' => null,
            'settlement_id' => (int) $fnfSettlement->id,
            'amount' => (float) $fnfSettlement->net_payable,
            'headcount' => 1,
            'what' => $fnfSettlement->employee_name . ' ka full and final',
        ], $data['verification_uuid'] ?? null, $data['code'] ?? null, $request->user());

        if ($verification !== null && ! $verification->isVerified()) {
            return ApiResponse::success([
                'verification' => $this->verifications->describe($verification),
            ], 'Safety ke liye code ' . $verification->sent_masked
                . ' par bheja gaya. Settlement bhejne ke liye wahi code daalo.', 202);
        }

        $disbursement = $this->transfers->transferSettlement(
            $fnfSettlement,
            $request->user(),
            isset($data['from_account_id']) ? (int) $data['from_account_id'] : null
        );

        $this->verifications->consume($verification, $request->user());

        return ApiResponse::success([
            'settlement' => new FnfSettlementResource($fnfSettlement->refresh()->load('lines')),
            'transfer' => [
                'uuid' => $disbursement->uuid,
                'status' => $disbursement->status,
                'status_label' => $disbursement->statusLabel(),
                'amount' => (float) $disbursement->amount,
                'utr' => $disbursement->utr,
                'reference' => $disbursement->reference,
                'failure_reason' => $disbursement->failure_reason,
            ],
        ], $disbursement->isSuccess()
            ? 'Settlement ka paisa bhej diya gaya'
            : 'Transfer poora nahi hua — ' . ($disbursement->failure_reason ?? 'bank ne mana kiya'));
    }

    public function mine(Request $request): JsonResponse
    {
        $settlements = FnfSettlement::query()
            ->whereHas('employee', fn ($query) => $query->where('user_id', $request->user()->id))
            ->whereIn('status', [FnfSettlement::APPROVED, FnfSettlement::SETTLED])
            ->with('lines')
            ->orderByDesc('last_working_date')
            ->get();

        return ApiResponse::success(
            FnfSettlementResource::collection($settlements),
            'Your settlement fetched successfully'
        );
    }

    private function companyId(): int
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'Settlements belong to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return $id;
    }
}

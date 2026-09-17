<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Resources\SalaryAdvanceResource;
use App\Models\Employee;
use App\Models\SalaryAdvance;
use App\Models\TransferVerification;
use App\Services\SalaryAdvanceService;
use App\Services\SalaryDisbursementService;
use App\Services\TransferVerificationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalaryAdvanceController extends ApiController
{
    public function __construct(
        private readonly SalaryAdvanceService $advances,
        private readonly SalaryDisbursementService $transfers,
        private readonly TransferVerificationService $verifications
    ) {}

    public function index(Request $request): JsonResponse
    {
        $rows = SalaryAdvance::query()
            ->visibleTo($request->user())
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('search'), fn ($q) => $q->where(fn ($inner) => $inner
                ->where('employee_name', 'like', '%' . $request->string('search') . '%')
                ->orWhere('employee_code', 'like', '%' . $request->string('search') . '%')
                ->orWhere('reference', 'like', '%' . $request->string('search') . '%')))
            ->orderByRaw("FIELD(status, 'pending', 'approved', 'disbursed') DESC")
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($rows, SalaryAdvanceResource::class, 'Advances fetched successfully');
    }

    public function summary(Request $request): JsonResponse
    {
        $base = SalaryAdvance::query()->visibleTo($request->user());

        return ApiResponse::success([
            'pending' => (clone $base)->where('status', SalaryAdvance::PENDING)->count(),
            'awaiting_transfer' => (clone $base)->where('status', SalaryAdvance::APPROVED)->count(),
            'running' => (clone $base)->where('status', SalaryAdvance::DISBURSED)->count(),
            'outstanding' => round((float) (clone $base)->where('status', SalaryAdvance::DISBURSED)->sum('outstanding'), 2),
            'given_this_year' => round((float) (clone $base)
                ->whereIn('status', [SalaryAdvance::DISBURSED, SalaryAdvance::CLOSED])
                ->whereYear('disbursed_at', now()->year)
                ->sum('amount'), 2),
        ], 'Advance summary fetched successfully');
    }

    public function show(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        return ApiResponse::success([
            'advance' => new SalaryAdvanceResource($salaryAdvance->load('recoveries', 'decidedBy')),
            'schedule' => $this->advances->schedule($salaryAdvance),
        ], 'Advance fetched successfully');
    }

    public function mine(Request $request): JsonResponse
    {
        $rows = SalaryAdvance::query()
            ->whereHas('employee', fn ($q) => $q->where('user_id', $request->user()->id))
            ->with('recoveries')
            ->orderByDesc('id')
            ->get();

        return ApiResponse::success(
            SalaryAdvanceResource::collection($rows),
            'Aapke advance fetched successfully'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_uuid' => ['nullable', 'string'],
            'amount' => ['required', 'numeric', 'min:1', 'max:99999999'],
            'tenure_months' => ['required', 'integer', 'min:1', 'max:60'],
            'emi_amount' => ['nullable', 'numeric', 'min:1', 'max:99999999'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $employee = $this->targetEmployee($request, $data['employee_uuid'] ?? null);

        return ApiResponse::created(
            new SalaryAdvanceResource($this->advances->request($employee, $data, $request->user())),
            'Advance request bhej diya gaya'
        );
    }

    public function decide(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        $data = $request->validate([
            'approve' => ['required', 'boolean'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $advance = $this->advances->decide(
            $salaryAdvance,
            (bool) $data['approve'],
            $data['note'] ?? null,
            $request->user()
        );

        return ApiResponse::success(
            new SalaryAdvanceResource($advance),
            $data['approve'] ? 'Advance approve ho gaya — ab transfer karo' : 'Advance reject ho gaya'
        );
    }

    public function updatePlan(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        $data = $request->validate([
            'emi_amount' => ['required', 'numeric', 'min:1', 'max:99999999'],
            'start_period' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        return ApiResponse::success(
            new SalaryAdvanceResource($this->advances->updatePlan($salaryAdvance, $data, $request->user())),
            'EMI plan update ho gaya'
        );
    }

    public function hold(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);

        return ApiResponse::success(
            new SalaryAdvanceResource($this->advances->hold($salaryAdvance, $data['reason'] ?? null, $request->user())),
            'Advance transfer rok diya gaya'
        );
    }

    public function release(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        return ApiResponse::success(
            new SalaryAdvanceResource($this->advances->release($salaryAdvance, $request->user())),
            'Advance transfer khol diya gaya'
        );
    }

    public function cancel(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        return ApiResponse::success(
            new SalaryAdvanceResource($this->advances->cancel($salaryAdvance, $request->user())),
            'Advance cancel ho gaya'
        );
    }

    public function quote(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        $quote = $this->transfers->quoteAdvance(
            $salaryAdvance,
            $request->filled('from_account_id') ? (int) $request->integer('from_account_id') : null
        );

        return ApiResponse::success([
            'amount' => $quote['amount'],
            'from' => $quote['from'] === null ? null : [
                'uuid' => $quote['from']->uuid,
                'bank_name' => $quote['from']->bank_name,
                'balance' => (float) $quote['from']->balance,
            ],
            'to' => $quote['to'],
            'provider' => $quote['provider'],
            'is_mock' => $quote['is_mock'],
            'can_transfer' => $quote['can_transfer'],
            'blockers' => $quote['blockers'],
        ], 'Transfer quote fetched successfully');
    }

    public function transfer(Request $request, SalaryAdvance $salaryAdvance): JsonResponse
    {
        $data = $request->validate([
            'from_account_id' => ['nullable', 'integer'],
            'verification_uuid' => ['nullable', 'string', 'max:40'],
            'code' => ['nullable', 'string', 'max:10'],
        ]);

        $quote = $this->transfers->quoteAdvance(
            $salaryAdvance,
            isset($data['from_account_id']) ? (int) $data['from_account_id'] : null
        );

        if (! $quote['can_transfer']) {
            throw new ApiException(implode(' ', $quote['blockers']), 422, 'TRANSFER_BLOCKED');
        }

        $verification = $this->verifications->guard([
            'company_id' => (int) $salaryAdvance->company_id,
            'purpose' => TransferVerification::ADVANCE,
            'action' => TransferVerification::TRANSFER,
            'item_id' => (int) $salaryAdvance->id,
            'run_id' => null,
            'settlement_id' => null,
            'amount' => (float) $salaryAdvance->amount,
            'headcount' => 1,
            'what' => $salaryAdvance->employee_name . ' ka salary advance',
        ], $data['verification_uuid'] ?? null, $data['code'] ?? null, $request->user());

        if ($verification !== null && ! $verification->isVerified()) {
            return ApiResponse::success([
                'verification' => $this->verifications->describe($verification),
            ], 'Safety ke liye code ' . $verification->sent_masked
                . ' par bheja gaya. Advance bhejne ke liye wahi code daalo.', 202);
        }

        $disbursement = $this->transfers->transferAdvance(
            $salaryAdvance,
            $request->user(),
            isset($data['from_account_id']) ? (int) $data['from_account_id'] : null
        );

        $this->verifications->consume($verification, $request->user());

        return ApiResponse::success([
            'advance' => new SalaryAdvanceResource($salaryAdvance->refresh()),
            'transfer' => [
                'uuid' => $disbursement->uuid,
                'status' => $disbursement->status,
                'amount' => (float) $disbursement->amount,
                'utr' => $disbursement->utr,
                'reference' => $disbursement->reference,
                'failure_reason' => $disbursement->failure_reason,
            ],
        ], $disbursement->isSuccess()
            ? 'Advance ka paisa bhej diya gaya — EMI agle mahine se katni shuru hogi'
            : 'Transfer poora nahi hua — ' . ($disbursement->failure_reason ?? 'bank ne mana kiya'));
    }

    private function targetEmployee(Request $request, ?string $uuid): Employee
    {
        if ($uuid === null) {
            $employee = Employee::query()->where('user_id', $request->user()->id)->first();

            if ($employee === null) {
                throw new ApiException('Aapka employee record nahi mila.', 422, 'EMPLOYEE_MISSING');
            }

            return $employee;
        }

        if (! $request->user()->hasPermission(SalaryAdvance::MANAGE_PERMISSION)) {
            throw new ApiException('Kisi aur ke liye advance nahi daal sakte.', 403, 'FORBIDDEN');
        }

        $employee = Employee::query()->where('uuid', $uuid)->first();

        if ($employee === null) {
            throw new ApiException('Ye employee nahi mila.', 404, 'EMPLOYEE_NOT_FOUND');
        }

        return $employee;
    }
}

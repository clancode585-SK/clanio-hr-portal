<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\ExpenseClaimRequest;
use App\Http\Requests\ExpenseDecisionRequest;
use App\Http\Requests\ExpensePaymentRequest;
use App\Http\Requests\ExpenseVerifyRequest;
use App\Http\Resources\ExpenseClaimResource;
use App\Models\ExpenseClaim;
use App\Services\ExpenseService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseClaimController extends ApiController
{
    public function __construct(private readonly ExpenseService $expenses) {}

    public function index(Request $request): JsonResponse
    {
        $claims = $this->scoped($request)->paginate($this->perPage($request));

        return ApiResponse::paginated($claims, ExpenseClaimResource::class, 'Expense claims fetched successfully');
    }

    public function categories(): JsonResponse
    {
        $categories = [];

        foreach (ExpenseClaim::CATEGORIES as $value => $label) {
            $categories[] = [
                'value' => $value,
                'label' => $label,
                'needs_purpose' => $value === ExpenseClaim::OTHER,
            ];
        }

        return ApiResponse::success([
            'categories' => $categories,
            'payment_modes' => ExpenseClaim::PAYMENT_MODES,
        ], 'Expense categories fetched successfully');
    }

    public function pendingApprovals(Request $request): JsonResponse
    {
        $claims = $this->scoped($request)
            ->where('status', ExpenseClaim::PENDING)
            ->whereHas('employee', fn (Builder $query) => $query->where('user_id', '!=', $request->user()->id))
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($claims, ExpenseClaimResource::class, 'Pending approvals fetched successfully');
    }

    public function pendingVerification(Request $request): JsonResponse
    {
        $claims = $this->scoped($request)
            ->where('status', ExpenseClaim::MANAGER_APPROVED)
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($claims, ExpenseClaimResource::class, 'HR verification queue fetched successfully');
    }

    public function pendingPayout(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->expenses->pendingPayout($request->user()),
            'Payment pending claims fetched successfully'
        );
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->expenses->summary(
                $request->user(),
                $request->filled('employee_id') ? (int) $request->input('employee_id') : null,
                $request->filled('month') ? $request->string('month')->toString() : now()->format('Y-m')
            ),
            'Expense summary fetched successfully'
        );
    }

    public function store(ExpenseClaimRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new ExpenseClaimResource(
                $this->expenses->apply($request->user(), $request->validated(), $request->file('bills') ?? [])
            ),
            'Reimbursement request bhej di gayi'
        );
    }

    public function show(ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::success(
            new ExpenseClaimResource(
                $claim->load('employee.user', 'approver', 'verifier', 'payer', 'bills.uploader')
            ),
            'Expense claim fetched successfully'
        );
    }

    public function update(ExpenseClaimRequest $request, ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::success(
            new ExpenseClaimResource(
                $this->expenses->update($claim, $request->validated(), $request->user())
            ),
            'Claim update ho gayi'
        );
    }

    public function approve(ExpenseDecisionRequest $request, ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::success(
            new ExpenseClaimResource(
                $this->expenses->approve($claim, $request->validated(), $request->user())
            ),
            'Claim approve ho gayi — ab HR verify karegi'
        );
    }

    public function verify(ExpenseVerifyRequest $request, ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::success(
            new ExpenseClaimResource(
                $this->expenses->verify($claim, $request->validated(), $request->user())
            ),
            'Claim verify ho gayi — payment pending'
        );
    }

    public function pay(ExpensePaymentRequest $request, ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::success(
            new ExpenseClaimResource(
                $this->expenses->pay($claim, $request->validated(), $request->user())
            ),
            'Payment record ho gaya'
        );
    }

    public function payMany(ExpensePaymentRequest $request): JsonResponse
    {
        $data = $request->validated();

        return ApiResponse::success(
            $this->expenses->payMany($data['claims'], $data, $request->user()),
            'Bulk payment process ho gaya'
        );
    }

    public function reject(ExpenseDecisionRequest $request, ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::success(
            new ExpenseClaimResource(
                $this->expenses->reject($claim, $request->validated(), $request->user())
            ),
            'Claim reject kar di gayi'
        );
    }

    public function destroy(Request $request, ExpenseClaim $claim): JsonResponse
    {
        return ApiResponse::success(
            new ExpenseClaimResource($this->expenses->cancel($claim, $request->user())),
            'Claim cancel ho gayi'
        );
    }

    private function scoped(Request $request): Builder
    {
        return $this->applyFilters(
            ExpenseClaim::query()
                ->with(['employee.user', 'approver', 'verifier', 'payer'])
                ->withCount('bills')
                ->visibleTo($request->user()),
            $request,
            ['description', 'purpose', 'payment_reference'],
            [
                'status' => 'status',
                'category' => 'category',
                'employee_id' => 'employee_id',
                'payment_mode' => 'payment_mode',
            ]
        )
            ->when($request->filled('from'), fn (Builder $query) => $query->whereDate('expense_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn (Builder $query) => $query->whereDate('expense_date', '<=', $request->date('to')))
            ->orderByRaw("FIELD(status, 'pending', 'manager_approved', 'verified', 'paid', 'rejected', 'cancelled')")
            ->orderByDesc('expense_date')
            ->orderByDesc('id');
    }
}

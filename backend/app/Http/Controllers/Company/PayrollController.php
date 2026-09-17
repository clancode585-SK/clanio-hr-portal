<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Resources\PayrollItemResource;
use App\Http\Resources\PayrollRunResource;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Services\PayrollService;
use App\Services\PayslipService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollController extends ApiController
{
    public function __construct(
        private readonly PayrollService $payroll,
        private readonly PayslipService $payslips
    ) {}

    public function index(Request $request): JsonResponse
    {
        $runs = PayrollRun::query()
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->orderByDesc('month')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($runs, PayrollRunResource::class, 'Payroll runs fetched successfully');
    }

    public function show(PayrollRun $payrollRun): JsonResponse
    {
        return ApiResponse::success(
            new PayrollRunResource($payrollRun->load('calculatedBy', 'approvedBy')),
            'Payroll run fetched successfully'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'pay_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        return ApiResponse::created(
            new PayrollRunResource($this->payroll->open($this->companyId(), $data, $request->user())),
            'Payroll opened successfully'
        );
    }

    public function calculate(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        return ApiResponse::success(
            new PayrollRunResource(
                $this->payroll->calculate($payrollRun, $request->user())->load('items.lines', 'items.run')
            ),
            'Payroll calculated successfully'
        );
    }

    public function approvalReview(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        return ApiResponse::success(
            $this->payroll->approvalReview($payrollRun, $request->user()),
            'Approval review fetched successfully'
        );
    }

    public function approveItem(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        return ApiResponse::success(
            new PayrollItemResource($this->payroll->approveItem($payrollItem, $request->user())),
            $payrollItem->employee_name . ' ki salary approve ho gayi'
        );
    }

    public function unapproveItem(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        return ApiResponse::success(
            new PayrollItemResource($this->payroll->unapproveItem($payrollItem, $request->user())),
            'Approval wapas le li'
        );
    }

    public function approveItems(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $data = $request->validate([
            'uuids' => ['nullable', 'array', 'max:2000'],
            'uuids.*' => ['string', 'max:40'],
        ]);

        $result = $this->payroll->approveItems($payrollRun, $request->user(), $data['uuids'] ?? null);

        return ApiResponse::success([
            'run' => new PayrollRunResource($result['run']),
            'looked_at' => $result['looked_at'],
            'approved' => $result['approved'],
            'already_approved' => $result['already_approved'],
            'approved_amount' => $result['approved_amount'],
            'skipped' => $result['skipped'],
        ], $result['approved'] . ' salary approve ho gayi'
            . (count($result['skipped']) > 0 ? ', ' . count($result['skipped']) . ' chhod di' : ''));
    }

    public function approve(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        return ApiResponse::success(
            new PayrollRunResource($this->payroll->approve($payrollRun, $request->user())),
            'Payroll approved — ab salary bheji ja sakti hai'
        );
    }

    public function cancel(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        return ApiResponse::success(
            new PayrollRunResource($this->payroll->cancel($payrollRun, $request->user())),
            'Payroll cancelled successfully'
        );
    }

    public function items(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $items = $payrollRun->items()
            ->with('run')
            ->when($request->filled('status'), fn ($query) => $query->where('payment_status', $request->string('status')))
            ->when($request->filled('approval'), fn ($query) => $query->where('approval_status', $request->string('approval')))
            ->when($request->filled('search'), fn ($query) => $query->where(fn ($inner) => $inner
                ->where('employee_name', 'like', '%' . $request->string('search') . '%')
                ->orWhere('employee_code', 'like', '%' . $request->string('search') . '%')))
            ->orderBy('employee_code')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($items, PayrollItemResource::class, 'Payslips fetched successfully');
    }

    public function showItem(PayrollItem $payrollItem): JsonResponse
    {
        return ApiResponse::success(
            new PayrollItemResource($payrollItem->load('lines', 'run')),
            'Payslip fetched successfully'
        );
    }

    public function setLop(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        $data = $request->validate([
            'lop_days' => ['required', 'numeric', 'min:0', 'max:31'],
        ]);

        return ApiResponse::success(
            new PayrollItemResource(
                $this->payroll->setLop($payrollItem, (float) $data['lop_days'], $request->user())->load('lines', 'run')
            ),
            'LOP updated and the payslip recalculated'
        );
    }

    public function hold(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        return ApiResponse::success(
            new PayrollItemResource($this->payroll->hold($payrollItem, $data['reason'] ?? null, $request->user())),
            'Payslip put on hold'
        );
    }

    public function release(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        return ApiResponse::success(
            new PayrollItemResource($this->payroll->release($payrollItem, $request->user())),
            'Payslip released'
        );
    }

    public function previewSlip(Request $request, PayrollItem $payrollItem): Response
    {
        $this->payslips->assertReadable($payrollItem, $request->user());

        return response(
            $this->payslips->html($payrollItem),
            200,
            ['Content-Type' => 'text/html; charset=utf-8']
        );
    }

    public function downloadSlip(Request $request, PayrollItem $payrollItem): StreamedResponse
    {
        $this->payslips->assertReadable($payrollItem, $request->user());

        $html = $this->payslips->html($payrollItem);

        return response()->streamDownload(
            static function () use ($html): void {
                echo $html;
            },
            $this->payslips->fileName($payrollItem),
            ['Content-Type' => 'text/html']
        );
    }

    public function mine(Request $request): JsonResponse
    {
        return ApiResponse::success(
            PayrollItemResource::collection($this->payroll->payslipsFor($request->user())),
            'Your payslips fetched successfully'
        );
    }

    private function companyId(): int
    {
        $id = $this->tenantId();

        if ($id === null) {
            throw new ApiException(
                'Payroll belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return $id;
    }
}

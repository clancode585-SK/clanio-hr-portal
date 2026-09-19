<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Resources\PayrollItemResource;
use App\Http\Resources\PayrollRunResource;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryComponent;
use App\Services\Form16Service;
use App\Services\PayrollService;
use App\Services\PayslipService;
use App\Support\ApiResponse;
use App\Support\CompanyTime;
use App\Support\Pdf;
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

        return Pdf::show($this->payslips->pdf($payrollItem), $this->payslips->fileName($payrollItem));
    }

    public function downloadSlip(Request $request, PayrollItem $payrollItem): StreamedResponse
    {
        $this->payslips->assertReadable($payrollItem, $request->user());

        return Pdf::send($this->payslips->pdf($payrollItem), $this->payslips->fileName($payrollItem));
    }

    public function mine(Request $request): JsonResponse
    {
        return ApiResponse::success(
            PayrollItemResource::collection($this->payroll->payslipsFor($request->user())),
            'Your payslips fetched successfully'
        );
    }

    public function form16(Request $request, Employee $employee): Response
    {
        $fy = $this->financialYear($request);
        $service = $this->form16Service();

        return Pdf::show($service->pdf($employee, $fy), $service->fileName($employee, $fy));
    }

    public function form16Download(Request $request, Employee $employee): StreamedResponse
    {
        $fy = $this->financialYear($request);
        $service = $this->form16Service();

        return Pdf::send($service->pdf($employee, $fy), $service->fileName($employee, $fy));
    }

    public function form16Bulk(Request $request): StreamedResponse
    {
        $fy = $this->financialYear($request);
        $built = $this->form16Service()->bulkPdf($this->companyId(), $fy, $request->boolean('only_tds'));

        return Pdf::send(
            $built['pdf'],
            'Form16B-all-' . $fy . '-' . substr((string) ($fy + 1), 2) . '.pdf',
            [
                'X-Generated-Count' => (string) $built['made'],
                'X-Skipped-Count' => (string) count($built['skipped']),
            ]
        );
    }

    private function form16Service(): Form16Service
    {
        return app(Form16Service::class);
    }

    // fy na aaye to chalta hua financial year — April se pehle pichhla saal
    private function financialYear(Request $request): int
    {
        if ($request->filled('fy')) {
            return (int) $request->integer('fy');
        }

        $now = CompanyTime::now();

        return $now->month >= 4 ? $now->year : $now->year - 1;
    }

    // Employee ke andar month chuno — us mahine ki salary, PF, TDS aur advance ek jagah
    public function employeeMonths(Request $request, Employee $employee): JsonResponse
    {
        $items = PayrollItem::query()
            ->where('employee_id', $employee->id)
            ->whereHas('run', fn ($q) => $q->whereIn('status', [PayrollRun::CALCULATED, PayrollRun::APPROVED, PayrollRun::PAID]))
            ->with('run')
            ->get()
            ->sortByDesc(fn (PayrollItem $item): string => (string) $item->run?->month)
            ->values();

        $months = $items->map(fn (PayrollItem $item): array => [
            'month' => $item->run?->month,
            'label' => $item->run?->monthLabel(),
            'status' => $item->run?->status,
            'gross' => (float) $item->gross_earnings,
            'net' => (float) $item->net_payable,
        ])->all();

        $picked = $request->filled('month')
            ? $items->firstWhere(fn (PayrollItem $item): bool => $item->run?->month === $request->string('month')->value())
            : $items->first();

        return ApiResponse::success([
            'employee' => [
                'uuid' => $employee->uuid,
                'employee_code' => $employee->employee_code,
                'name' => $employee->user?->name,
                'has_pf_account' => (bool) $employee->has_pf_account,
                'uan_number' => $employee->uan_number,
                'tax_regime' => $employee->tax_regime,
            ],
            'months' => $months,
            'selected' => $picked === null ? null : $this->monthDetail($picked),
        ], 'Employee payroll fetched successfully');
    }

    private function monthDetail(PayrollItem $item): array
    {
        $lines = $item->lines()->get();
        $pick = fn (string $code): float => (float) ($lines->firstWhere('code', $code)?->amount ?? 0);

        return [
            'month' => $item->run?->month,
            'label' => $item->run?->monthLabel(),
            'status' => $item->run?->status,
            'working_days' => (float) $item->working_days,
            'lop_days' => (float) $item->lop_days,
            'paid_days' => (float) $item->paid_days,
            'gross_earnings' => (float) $item->gross_earnings,
            'total_deductions' => (float) $item->total_deductions,
            'employer_cost' => (float) $item->employer_cost,
            'net_payable' => (float) $item->net_payable,
            'pf_employee' => $pick(SalaryComponent::PF_EMPLOYEE),
            'pf_employer' => $pick(SalaryComponent::PF_EMPLOYER),
            'esi_employee' => $pick(SalaryComponent::ESI_EMPLOYEE),
            'esi_employer' => $pick(SalaryComponent::ESI_EMPLOYER),
            'professional_tax' => $pick(SalaryComponent::PROFESSIONAL_TAX),
            'tds' => $pick(SalaryComponent::TDS),
            'advance_emi' => $pick('ADVANCE'),
            'lines' => $lines->map(fn ($line): array => [
                'code' => $line->code,
                'name' => $line->name,
                'kind' => $line->kind,
                'full_amount' => (float) $line->full_amount,
                'amount' => (float) $line->amount,
                'is_statutory' => (bool) $line->is_statutory,
            ])->values()->all(),
        ];
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

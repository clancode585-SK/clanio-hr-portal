<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Services\InvoiceService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InvoiceController extends ApiController
{
    public function __construct(private readonly InvoiceService $invoices) {}

    public function index(Request $request): JsonResponse
    {
        $invoices = $this->applyFilters(
            $this->scoped($request)->with('company'),
            $request,
            ['invoice_number', 'billed_to_name'],
            ['status' => 'status', 'plan_code' => 'plan_code']
        )
            ->when(
                $request->filled('company_id'),
                fn (Builder $query): Builder => $query->where('company_id', $request->integer('company_id'))
            )
            ->when(
                $request->filled('from'),
                fn (Builder $query): Builder => $query->whereDate('issued_at', '>=', $request->date('from'))
            )
            ->when(
                $request->filled('to'),
                fn (Builder $query): Builder => $query->whereDate('issued_at', '<=', $request->date('to'))
            )
            ->latest('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($invoices, InvoiceResource::class, 'Invoices fetched successfully');
    }

    public function summary(Request $request): JsonResponse
    {
        $base = $this->scoped($request);

        $collected = (clone $base)->where('status', Invoice::STATUS_PAID)->sum('total');
        $awaited = (clone $base)->where('status', Invoice::STATUS_PENDING)->sum('total');

        return ApiResponse::success([
            'total' => (clone $base)->count(),
            'paid' => (clone $base)->where('status', Invoice::STATUS_PAID)->count(),
            'pending' => (clone $base)->where('status', Invoice::STATUS_PENDING)->count(),
            'cancelled' => (clone $base)->where('status', Invoice::STATUS_CANCELLED)->count(),
            'collected' => round((float) $collected, 2),
            'awaited' => round((float) $awaited, 2),
        ], 'Invoice summary fetched successfully');
    }

    public function show(Request $request, string $invoice): JsonResponse
    {
        return ApiResponse::success(
            new InvoiceResource($this->find($request, $invoice)->load('company')),
            'Invoice fetched successfully'
        );
    }

    public function download(Request $request, string $invoice): StreamedResponse
    {
        $found = $this->find($request, $invoice);
        $csv = $this->invoices->asCsv($found);

        return response()->streamDownload(
            static function () use ($csv): void {
                echo $csv;
            },
            $found->invoice_number . '.csv',
            ['Content-Type' => 'text/csv']
        );
    }

    public function markPaid(Request $request, string $invoice): JsonResponse
    {
        $data = $request->validate([
            'payment_reference' => ['required', 'string', 'max:60'],
            'payment_method' => ['nullable', 'string', 'max:30'],
        ]);

        $updated = $this->invoices->markPaid(
            $this->find($request, $invoice),
            $request->user(),
            $data['payment_reference'],
            $data['payment_method'] ?? null
        );

        return ApiResponse::success(
            new InvoiceResource($updated->load('company')),
            'Invoice ' . $updated->invoice_number . ' marked paid'
        );
    }

    public function cancel(Request $request, string $invoice): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $updated = $this->invoices->cancel($this->find($request, $invoice), $request->user(), $data['reason'] ?? null);

        return ApiResponse::success(
            new InvoiceResource($updated->load('company')),
            'Invoice ' . $updated->invoice_number . ' cancelled'
        );
    }

    private function scoped(Request $request): Builder
    {
        $query = Invoice::query();
        $user = $request->user();

        if ($user->isSuperAdmin()) {
            return $this->tenantId() === null
                ? $query
                : $query->where('company_id', $this->tenantId());
        }

        return $query->where('company_id', $user->company_id);
    }

    private function find(Request $request, string $key): Invoice
    {
        $invoice = $this->scoped($request)
            ->where(fn (Builder $query): Builder => $query->where('uuid', $key)->orWhere('id', (int) $key))
            ->first();

        if ($invoice === null) {
            throw new ApiException('Invoice not found.', 404, 'NOT_FOUND');
        }

        return $invoice;
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\User;
use App\Support\CompanyTime;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

final class InvoiceService
{
    private const PREFIX = 'CLN';

    public function issueForPlan(
        Company $company,
        Plan $plan,
        int $seats,
        User $actor,
        ?string $paymentReference = null,
        ?string $paymentMethod = null
    ): Invoice {
        $price = $plan->priceFor($seats);
        $start = CompanyTime::day($company);
        $end = $plan->billing_cycle === 'yearly'
            ? $start->copy()->addYear()->subDay()
            : $start->copy()->addMonth()->subDay();

        $paid = $paymentReference !== null && $paymentReference !== '';

        return DB::transaction(function () use (
            $company,
            $plan,
            $seats,
            $actor,
            $price,
            $start,
            $end,
            $paid,
            $paymentReference,
            $paymentMethod
        ): Invoice {
            $invoice = new Invoice([
                'plan_id' => $plan->id,
                'invoice_number' => $this->nextNumber($start),
                'plan_name' => $plan->name,
                'plan_code' => $plan->code,
                'seats' => $seats,
                'price_per_seat' => $price['price_per_seat'],
                'currency' => $plan->currency,
                'billing_cycle' => $plan->billing_cycle,
                'subtotal' => $price['subtotal'],
                'gst_percent' => $price['gst_percent'],
                'gst_amount' => $price['gst'],
                'total' => $price['total'],
                'status' => $paid ? Invoice::STATUS_PAID : Invoice::STATUS_PENDING,
                'period_start' => $start->toDateString(),
                'period_end' => $end->toDateString(),
                'issued_at' => Carbon::now(),
                'paid_at' => $paid ? Carbon::now() : null,
                'payment_method' => $paid ? ($paymentMethod ?? 'test') : null,
                'payment_reference' => $paid ? $paymentReference : null,
                'billed_to_name' => (string) ($company->legal_name ?: $company->name),
                'billed_to_email' => $company->email,
                'billed_to_gstin' => $company->gstin,
                'billed_to_address' => $this->addressOf($company),
            ]);

            $invoice->company_id = $company->id;
            $invoice->created_by = $actor->id;
            $invoice->save();

            return $invoice;
        });
    }

    public function markPaid(Invoice $invoice, User $actor, ?string $reference, ?string $method): Invoice
    {
        if ($invoice->status === Invoice::STATUS_CANCELLED) {
            throw new ApiException('A cancelled invoice cannot be marked paid.', 409, 'INVOICE_CANCELLED');
        }

        if ($invoice->isPaid()) {
            throw new ApiException('This invoice is already paid.', 409, 'INVOICE_ALREADY_PAID');
        }

        $invoice->forceFill([
            'status' => Invoice::STATUS_PAID,
            'paid_at' => Carbon::now(),
            'payment_reference' => $reference,
            'payment_method' => $method ?? 'manual',
            'updated_by' => $actor->id,
        ])->save();

        return $invoice->refresh();
    }

    public function cancel(Invoice $invoice, User $actor, ?string $reason): Invoice
    {
        if ($invoice->isPaid()) {
            throw new ApiException('A paid invoice cannot be cancelled. Raise a credit note instead.', 409, 'INVOICE_PAID');
        }

        if ($invoice->status === Invoice::STATUS_CANCELLED) {
            throw new ApiException('This invoice is already cancelled.', 409, 'INVOICE_CANCELLED');
        }

        $invoice->forceFill([
            'status' => Invoice::STATUS_CANCELLED,
            'notes' => $reason,
            'updated_by' => $actor->id,
        ])->save();

        return $invoice->refresh();
    }

    public function asCsv(Invoice $invoice): string
    {
        $rows = [
            ['Invoice', $invoice->invoice_number],
            ['Issued on', $invoice->issued_at?->toDateString()],
            ['Status', ucfirst($invoice->status)],
            ['Billed to', $invoice->billed_to_name],
            ['Email', $invoice->billed_to_email],
            ['GSTIN', $invoice->billed_to_gstin],
            ['Address', $invoice->billed_to_address],
            [],
            ['Description', 'Seats', 'Rate', 'Amount'],
            [
                $invoice->plan_name . ' plan (' . $invoice->period_start?->toDateString() . ' to ' . $invoice->period_end?->toDateString() . ')',
                (string) $invoice->seats,
                number_format($invoice->price_per_seat, 2, '.', ''),
                number_format($invoice->subtotal, 2, '.', ''),
            ],
            [],
            ['Subtotal', '', '', number_format($invoice->subtotal, 2, '.', '')],
            ['GST ' . rtrim(rtrim(number_format($invoice->gst_percent, 2, '.', ''), '0'), '.') . '%', '', '', number_format($invoice->gst_amount, 2, '.', '')],
            ['Total ' . $invoice->currency, '', '', number_format($invoice->total, 2, '.', '')],
        ];

        if ($invoice->isPaid()) {
            $rows[] = [];
            $rows[] = ['Paid on', $invoice->paid_at?->toDateString()];
            $rows[] = ['Reference', $invoice->payment_reference];
            $rows[] = ['Method', $invoice->payment_method];
        }

        $handle = fopen('php://temp', 'r+');

        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }

        rewind($handle);
        $csv = (string) stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    private function nextNumber(Carbon $on): string
    {
        $year = $on->year;
        $prefix = self::PREFIX . '-' . $year . '-';

        $last = Invoice::query()
            ->withoutGlobalScopes()
            ->where('invoice_number', 'like', $prefix . '%')
            ->lockForUpdate()
            ->orderByDesc('invoice_number')
            ->value('invoice_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, strlen($prefix))) + 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function addressOf(Company $company): ?string
    {
        $parts = array_filter([
            $company->address,
            $company->city,
            $company->state,
            $company->pincode,
            $company->country,
        ]);

        return $parts === [] ? null : implode(', ', $parts);
    }
}

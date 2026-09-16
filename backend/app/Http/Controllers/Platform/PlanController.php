<?php

declare(strict_types=1);

namespace App\Http\Controllers\Platform;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\PlanRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Company;
use App\Models\Plan;
use App\Services\InvoiceService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends ApiController
{
    public function __construct(private readonly InvoiceService $invoices) {}

    public function index(Request $request): JsonResponse
    {
        $plans = Plan::query()
            ->withCount('companies')
            ->orderBy('sort_order')
            ->get()
            ->map(fn (Plan $plan): array => $this->shape($plan, $request->integer('seats')));

        return ApiResponse::success($plans, 'Plans fetched successfully');
    }

    public function show(Request $request, Plan $plan): JsonResponse
    {
        return ApiResponse::success($this->shape($plan, $request->integer('seats')), 'Plan fetched successfully');
    }

    public function store(PlanRequest $request): JsonResponse
    {
        $plan = new Plan($request->validated());
        $plan->created_by = $request->user()->id;
        $plan->save();

        TenantCache::flush(TenantCache::COMPANIES);

        return ApiResponse::created($this->shape($plan, 0), 'Plan created successfully');
    }

    public function update(PlanRequest $request, Plan $plan): JsonResponse
    {
        $plan->fill($request->validated());
        $plan->updated_by = $request->user()->id;
        $plan->save();

        TenantCache::flush(TenantCache::COMPANIES);

        return ApiResponse::success($this->shape($plan->refresh(), 0), 'Plan updated successfully');
    }

    public function destroy(Plan $plan): JsonResponse
    {
        if ($plan->companies()->count() > 0) {
            throw new ApiException(
                'Companies are still on this plan. Move them across first.',
                409,
                'PLAN_IN_USE'
            );
        }

        $plan->deactivate();

        TenantCache::flush(TenantCache::COMPANIES);

        return ApiResponse::success(null, 'Plan removed');
    }

    public function assign(Request $request, Company $company): JsonResponse
    {
        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'seats' => ['nullable', 'integer', 'between:1,10000'],
            'payment_reference' => ['nullable', 'string', 'max:60'],
            'payment_method' => ['nullable', 'string', 'max:30'],
        ]);

        $plan = Plan::query()->findOrFail($data['plan_id']);
        $seats = (int) ($data['seats'] ?? $company->max_employees ?? $plan->min_seats);

        if ($seats < $plan->min_seats || $seats > $plan->max_seats) {
            throw new ApiException(
                $plan->name . ' takes ' . $plan->min_seats . ' to ' . $plan->max_seats . ' seats.',
                422,
                'PLAN_SEATS_OUT_OF_RANGE'
            );
        }

        $changed = (int) $company->plan_id !== (int) $plan->id || (int) $company->max_employees !== $seats;

        $company->plan_id = $plan->id;
        $company->max_employees = $seats;
        $company->updated_by = $request->user()->id;
        $company->save();

        TenantCache::flush(TenantCache::COMPANIES);

        $invoice = $changed
            ? $this->invoices->issueForPlan(
                $company,
                $plan,
                $seats,
                $request->user(),
                $data['payment_reference'] ?? null,
                $data['payment_method'] ?? null
            )
            : null;

        return ApiResponse::success(
            [
                'company_id' => $company->id,
                'plan' => $this->shape($plan, $seats),
                'invoice' => $invoice === null ? null : new InvoiceResource($invoice),
            ],
            $invoice === null
                ? $company->name . ' is already on ' . $plan->name
                : $company->name . ' is now on ' . $plan->name . '. Invoice ' . $invoice->invoice_number . ' raised.'
        );
    }

    private function shape(Plan $plan, int $seats): array
    {
        $priced = $seats > 0 ? $seats : $plan->min_seats;

        return [
            'id' => $plan->id,
            'uuid' => $plan->uuid,
            'name' => $plan->name,
            'code' => $plan->code,
            'tagline' => $plan->tagline,
            'price_per_seat' => $plan->price_per_seat,
            'currency' => $plan->currency,
            'billing_cycle' => $plan->billing_cycle,
            'min_seats' => $plan->min_seats,
            'max_seats' => $plan->max_seats,
            'trial_days' => $plan->trial_days,
            'gst_percent' => $plan->gst_percent,
            'highlights' => $plan->highlightList(),
            'is_popular' => $plan->is_popular,
            'sort_order' => $plan->sort_order,
            'company_count' => $plan->companies_count ?? $plan->companies()->count(),
            'pricing' => $plan->priceFor($priced),
        ];
    }
}

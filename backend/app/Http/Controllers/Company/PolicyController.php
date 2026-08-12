<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\PolicyRequest;
use App\Http\Resources\PolicyAcknowledgementResource;
use App\Http\Resources\PolicyResource;
use App\Models\Policy;
use App\Services\PolicyService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PolicyController extends ApiController
{
    public function __construct(private readonly PolicyService $policies) {}

    public function categories(): JsonResponse
    {
        $categories = [];

        foreach (Policy::CATEGORIES as $value => $label) {
            $categories[] = ['value' => $value, 'label' => $label];
        }

        return ApiResponse::success([
            'categories' => $categories,
            'statuses' => Policy::STATUSES,
        ], 'Policy categories fetched successfully');
    }

    public function index(Request $request): JsonResponse
    {
        $policies = $this->applyFilters(
            Policy::query()->with('publisher')->withCount('acknowledgements'),
            $request,
            ['title', 'summary'],
            ['status' => 'status', 'category' => 'category']
        )->orderByDesc('effective_from')->orderByDesc('id')->paginate($this->perPage($request));

        return ApiResponse::paginated($policies, PolicyResource::class, 'Policies fetched successfully');
    }

    public function myPolicies(Request $request): JsonResponse
    {
        $data = $this->policies->myPolicies($request->user());

        return ApiResponse::success([
            'total' => $data['total'],
            'pending' => $data['pending'],
            'acknowledged' => $data['acknowledged'],
            'gate_cleared' => $data['gate_cleared'],
            'items' => PolicyAcknowledgementResource::collection($data['items']),
        ], 'My policies fetched successfully');
    }

    public function store(PolicyRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new PolicyResource($this->policies->create(
                $request->safe()->except('file'),
                $request->file('file'),
                $request->user(),
                $this->tenantId()
            )),
            'Policy draft ban gaya'
        );
    }

    public function show(Policy $policy): JsonResponse
    {
        return ApiResponse::success(
            new PolicyResource($policy->load('publisher')->loadCount('acknowledgements')),
            'Policy fetched successfully'
        );
    }

    public function update(PolicyRequest $request, Policy $policy): JsonResponse
    {
        return ApiResponse::success(
            new PolicyResource($this->policies->update(
                $policy,
                $request->safe()->except('file'),
                $request->file('file'),
                $request->user()
            )),
            'Policy update ho gayi'
        );
    }

    public function publish(Request $request, Policy $policy): JsonResponse
    {
        $result = $this->policies->publish($policy, $request->user());

        return ApiResponse::success([
            'policy' => new PolicyResource($result['policy']),
            'assigned' => $result['assigned'],
        ], 'Policy publish ho gayi — ' . $result['assigned'] . ' employee ko bhej di gayi');
    }

    public function archive(Request $request, Policy $policy): JsonResponse
    {
        return ApiResponse::success(
            new PolicyResource($this->policies->archive($policy, $request->user())),
            'Policy archive ho gayi'
        );
    }

    public function acknowledge(PolicyRequest $request, Policy $policy): JsonResponse
    {
        return ApiResponse::success(
            new PolicyAcknowledgementResource(
                $this->policies->acknowledge($policy, $request->validated(), $request->user(), $request->ip())
            ),
            'Policy accept ho gayi'
        );
    }

    public function compliance(Request $request, Policy $policy): JsonResponse
    {
        return ApiResponse::success(
            $this->policies->compliance($policy, $request->user()),
            'Policy compliance fetched successfully'
        );
    }

    public function download(Policy $policy): StreamedResponse
    {
        return $this->policies->download($policy);
    }

    public function destroy(Request $request, Policy $policy): JsonResponse
    {
        $this->policies->delete($policy, $request->user());

        return ApiResponse::success(null, 'Policy draft hata diya gaya');
    }
}

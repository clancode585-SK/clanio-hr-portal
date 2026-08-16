<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\ClearanceItemRequest;
use App\Http\Requests\ClearanceSignRequest;
use App\Http\Resources\ClearanceItemResource;
use App\Http\Resources\ExitClearanceResource;
use App\Models\ClearanceItem;
use App\Models\EmployeeExit;
use App\Models\ExitClearance;
use App\Services\ClearanceService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClearanceController extends ApiController
{
    public function __construct(private readonly ClearanceService $clearance) {}

    public function departments(): JsonResponse
    {
        $departments = [];

        foreach (ClearanceItem::DEPARTMENTS as $value => $label) {
            $departments[] = ['value' => $value, 'label' => $label];
        }

        return ApiResponse::success([
            'departments' => $departments,
            'statuses' => ExitClearance::STATUSES,
        ], 'Clearance departments fetched successfully');
    }

    public function index(Request $request): JsonResponse
    {
        $items = $this->applyFilters(
            ClearanceItem::query(),
            $request,
            ['title'],
            ['department' => 'department']
        )->orderBy('department')->orderBy('sort_order')->paginate($this->perPage($request));

        return ApiResponse::paginated($items, ClearanceItemResource::class, 'Clearance items fetched successfully');
    }

    public function store(ClearanceItemRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new ClearanceItemResource(
                $this->clearance->createItem($request->validated(), $request->user(), $this->tenantId())
            ),
            'Clearance item ban gaya'
        );
    }

    public function show(ClearanceItem $item): JsonResponse
    {
        return ApiResponse::success(new ClearanceItemResource($item), 'Clearance item fetched successfully');
    }

    public function update(ClearanceItemRequest $request, ClearanceItem $item): JsonResponse
    {
        return ApiResponse::success(
            new ClearanceItemResource($this->clearance->updateItem($item, $request->validated(), $request->user())),
            'Clearance item update ho gaya'
        );
    }

    public function destroy(Request $request, ClearanceItem $item): JsonResponse
    {
        $this->clearance->deleteItem($item, $request->user());

        return ApiResponse::success(null, 'Clearance item hata diya gaya');
    }

    public function forExit(EmployeeExit $exit): JsonResponse
    {
        $data = $this->clearance->forExit($exit);

        return ApiResponse::success([
            'summary' => $data['summary'],
            'items' => ExitClearanceResource::collection($data['items']),
        ], 'Exit clearance fetched successfully');
    }

    public function sign(ClearanceSignRequest $request, EmployeeExit $exit, ExitClearance $clearance): JsonResponse
    {
        return ApiResponse::success(
            new ExitClearanceResource($this->clearance->sign($clearance, $request->validated(), $request->user())),
            'Clearance sign ho gaya'
        );
    }

    public function pending(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->clearance->pendingFor($request->user()),
            'Pending clearance fetched successfully'
        );
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\HolidayBulkRequest;
use App\Http\Requests\HolidayRequest;
use App\Http\Resources\HolidayResource;
use App\Models\Holiday;
use App\Services\HolidayService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HolidayController extends ApiController
{
    public function __construct(private readonly HolidayService $holidays) {}

    public function index(Request $request): JsonResponse
    {
        $holidays = TenantCache::remember(
            TenantCache::HOLIDAYS,
            'list:' . $this->cacheKey($request),
            fn () => $this->applyFilters(
                Holiday::query()->with('branch'),
                $request,
                ['name'],
                ['type' => 'type', 'branch_id' => 'branch_id']
            )
                ->when($request->filled('year'), fn ($query) => $query->whereYear('holiday_date', $request->integer('year')))
                ->when($request->filled('from'), fn ($query) => $query->whereDate('holiday_date', '>=', $request->date('from')))
                ->when($request->filled('to'), fn ($query) => $query->whereDate('holiday_date', '<=', $request->date('to')))
                ->orderBy('holiday_date')
                ->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($holidays, HolidayResource::class, 'Holidays fetched successfully');
    }

    public function store(HolidayRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new HolidayResource($this->holidays->create($request->validated(), $request->user(), $this->tenantId())),
            'Holiday created successfully'
        );
    }

    public function storeMany(HolidayBulkRequest $request): JsonResponse
    {
        $holidays = $this->holidays->createMany(
            $request->validated('holidays'),
            $request->user(),
            $this->tenantId()
        );

        return ApiResponse::created(
            HolidayResource::collection($holidays),
            $holidays->count() . ' holidays created successfully'
        );
    }

    public function show(Holiday $holiday): JsonResponse
    {
        return ApiResponse::success(
            new HolidayResource($holiday->load('branch')),
            'Holiday details fetched successfully'
        );
    }

    public function update(HolidayRequest $request, Holiday $holiday): JsonResponse
    {
        return ApiResponse::success(
            new HolidayResource($this->holidays->update($holiday, $request->validated(), $request->user())),
            'Holiday updated successfully'
        );
    }

    public function destroy(Holiday $holiday): JsonResponse
    {
        $this->holidays->delete($holiday);

        return ApiResponse::success(null, 'Holiday deleted successfully');
    }
}

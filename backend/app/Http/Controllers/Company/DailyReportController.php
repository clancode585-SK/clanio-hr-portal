<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\DailyReportDateRequest;
use App\Http\Requests\DailyReportEodRequest;
use App\Http\Requests\DailyReportSodRequest;
use App\Http\Resources\DailyReportResource;
use App\Models\DailyReport;
use App\Services\DailyReportService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DailyReportController extends ApiController
{
    public function __construct(private readonly DailyReportService $reports) {}

    public function index(Request $request): JsonResponse
    {
        $records = $this->applyFilters(
            DailyReport::query()
                ->with(['employee.user', 'sodItems.task', 'eodItems.task'])
                ->visibleTo($request->user()),
            $request,
            ['sod_plan', 'eod_summary'],
            ['employee_id' => 'employee_id', 'status' => 'status']
        )
            ->when($request->filled('from'), fn (Builder $query) => $query->whereDate('report_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn (Builder $query) => $query->whereDate('report_date', '<=', $request->date('to')))
            ->orderByDesc('report_date')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($records, DailyReportResource::class, 'Daily reports fetched successfully');
    }

    public function today(DailyReportDateRequest $request): JsonResponse
    {
        $data = $this->reports->forDate($request->user(), $request->reportDate());
        $data['report'] = $data['report'] === null ? null : new DailyReportResource($data['report']);

        return ApiResponse::success($data, 'Daily report fetched successfully');
    }

    public function teamStatus(DailyReportDateRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reports->teamStatus($request->user(), $request->reportDate()),
            'Team report status fetched successfully'
        );
    }

    public function storeSod(DailyReportSodRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new DailyReportResource($this->reports->submitSod($request->user(), $request->validated())),
            'SOD submitted successfully'
        );
    }

    public function storeEod(DailyReportEodRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new DailyReportResource($this->reports->submitEod($request->user(), $request->validated())),
            'EOD submitted successfully'
        );
    }

    public function show(DailyReport $dailyReport): JsonResponse
    {
        return ApiResponse::success(
            new DailyReportResource($dailyReport->load(['employee.user', 'sodItems.task', 'eodItems.task'])),
            'Daily report fetched successfully'
        );
    }
}

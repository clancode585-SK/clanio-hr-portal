<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\CalendarRequest;
use App\Http\Requests\PunchRequest;
use App\Http\Resources\AttendanceResource;
use App\Models\Attendance;
use App\Services\AttendanceService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends ApiController
{
    public function __construct(private readonly AttendanceService $attendance) {}

    public function index(Request $request): JsonResponse
    {
        $records = TenantCache::remember(
            TenantCache::ATTENDANCE,
            'list:' . $request->user()->id . ':' . $this->cacheKey($request),
            fn () => $this->applyFilters(
                Attendance::query()
                    ->with(['employee.user', 'openDetail'])
                    ->visibleTo($request->user()),
                $request,
                [],
                [
                    'status' => 'status',
                    'employee_id' => 'employee_id',
                    'attendance_date' => 'attendance_date',
                ]
            )
                ->when($request->filled('from'), fn ($query) => $query->whereDate('attendance_date', '>=', $request->date('from')))
                ->when($request->filled('to'), fn ($query) => $query->whereDate('attendance_date', '<=', $request->date('to')))
                ->orderByDesc('attendance_date')
                ->orderBy('employee_id')
                ->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($records, AttendanceResource::class, 'Attendance fetched successfully');
    }

    public function show(Attendance $attendance): JsonResponse
    {
        return ApiResponse::success(
            new AttendanceResource($attendance->load(['details', 'employee.user', 'openDetail', 'workShift'])),
            'Attendance details fetched successfully'
        );
    }

    public function today(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->attendance->today($request->user()),
            'Today attendance fetched successfully'
        );
    }

    public function calendar(CalendarRequest $request): JsonResponse
    {
        $employeeId = $request->validated('employee_id');

        return ApiResponse::success(
            $this->attendance->calendar(
                $request->user(),
                $request->validated('month') ?? now()->format('Y-m'),
                $employeeId === null ? null : (int) $employeeId
            ),
            'Attendance calendar fetched successfully'
        );
    }

    public function checkIn(PunchRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new AttendanceResource($this->attendance->checkIn($request->user(), $request->validated(), $request)),
            'Checked in successfully'
        );
    }

    public function checkOut(PunchRequest $request): JsonResponse
    {
        $attendance = $this->attendance->checkOut($request->user(), $request->validated(), $request);

        return ApiResponse::success(
            new AttendanceResource($attendance),
            'Checked out successfully. Total time today: ' . Attendance::humanDuration($attendance->worked_minutes)
        );
    }
}

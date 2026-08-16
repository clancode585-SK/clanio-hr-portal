<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Attendance;
use App\Models\AttendanceDetail;
use App\Models\Company;
use App\Models\Employee;
use App\Services\AttendanceService;
use App\Services\NotificationService;
use App\Support\NotificationType;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use App\Support\WorkCalendar;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class CloseOpenPunches extends Command
{
    protected $signature = 'attendance:auto-checkout {--stale-only : Sirf pichle dino ki khuli punch band karo}';

    protected $description = 'Bhooli hui check-out band karta hai taaki agle din check-in na atke';

    private const MAX_HOURS = 12;

    public function __construct(
        private readonly AttendanceService $attendance,
        private readonly NotificationService $notifications
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $staleOnly = (bool) $this->option('stale-only');
        $today = Carbon::today();
        $closed = 0;

        foreach (Company::query()->where('status', 'active')->get(['id']) as $company) {
            app(TenantContext::class)->set($company);

            $details = AttendanceDetail::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $company->id)
                ->whereNull('check_out_at')
                ->when($staleOnly, fn ($query) => $query->whereDate('check_in_at', '<', $today->toDateString()))
                ->orderBy('check_in_at')
                ->get();

            foreach ($details as $detail) {
                $employee = Employee::query()
                    ->withoutGlobalScope(CompanyScope::class)
                    ->with('user:id,name')
                    ->find($detail->employee_id);

                if ($employee === null) {
                    continue;
                }

                $checkIn = Carbon::parse($detail->check_in_at);
                $shift = WorkCalendar::shiftFor($employee);

                if (! $staleOnly && $checkIn->isSameDay($today) && $this->isOvernight($shift)) {
                    continue;
                }

                $closeAt = $this->closeTime($checkIn, $shift);

                $detail->forceFill([
                    'check_out_at' => $closeAt,
                    'worked_minutes' => max(0, (int) $checkIn->diffInMinutes($closeAt)),
                    'source' => 'auto',
                ])->save();

                $attendance = Attendance::query()
                    ->withoutGlobalScope(CompanyScope::class)
                    ->find($detail->attendance_id);

                if ($attendance !== null) {
                    $this->attendance->recalculateFor($attendance, $employee);
                }

                $this->notify($employee, $checkIn, $closeAt);
                $closed++;
            }
        }

        app(TenantContext::class)->forget();

        $this->info($closed . ' khuli punch band ki gayi.');

        return self::SUCCESS;
    }

    private function isOvernight(mixed $shift): bool
    {
        if ($shift === null) {
            return false;
        }

        return substr((string) $shift->end_time, 0, 8) <= substr((string) $shift->start_time, 0, 8);
    }

    private function closeTime(Carbon $checkIn, mixed $shift): Carbon
    {
        $limit = $checkIn->copy()->addHours(self::MAX_HOURS);

        $closeAt = $shift === null
            ? $checkIn->copy()->addHours(9)
            : $checkIn->copy()->setTimeFromTimeString((string) $shift->end_time);

        if ($closeAt->lessThanOrEqualTo($checkIn)) {
            $closeAt = $checkIn->copy()->addHours(9);
        }

        if ($closeAt->greaterThan($limit)) {
            $closeAt = $limit;
        }

        $now = Carbon::now();

        return $closeAt->greaterThan($now) ? $now : $closeAt;
    }

    private function notify(Employee $employee, Carbon $checkIn, Carbon $closeAt): void
    {
        if ($employee->user_id === null) {
            return;
        }

        $this->notifications->send((int) $employee->user_id, [
            'type' => NotificationType::ATTENDANCE_AUTO_CHECKOUT,
            'title' => 'Check-out nahi laga tha — system ne band kar diya',
            'body' => $checkIn->format('d M Y') . ' ka punch ' . $closeAt->format('h:i A')
                . ' par band kiya gaya. Galat ho to regularization bhej do.',
            'action_url' => '/regularizations',
            'entity_type' => 'attendance',
            'entity_id' => null,
            'payload' => [
                'date' => $checkIn->toDateString(),
                'check_in' => $checkIn->toDateTimeString(),
                'auto_check_out' => $closeAt->toDateTimeString(),
            ],
            'dedupe_key' => 'auto-checkout:' . $employee->id . ':' . $checkIn->toDateString(),
        ]);
    }
}

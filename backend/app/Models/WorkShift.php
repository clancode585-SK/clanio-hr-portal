<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

class WorkShift extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    public const DAYS = [
        0 => 'sunday',
        1 => 'monday',
        2 => 'tuesday',
        3 => 'wednesday',
        4 => 'thursday',
        5 => 'friday',
        6 => 'saturday',
    ];

    protected $fillable = [
        'name',
        'code',
        'start_time',
        'end_time',
        'grace_minutes',
        'half_day_minutes',
        'full_day_minutes',
        'weekly_offs',
        'is_default',
        'status',
    ];

    protected $attributes = [
        'start_time' => '09:30:00',
        'end_time' => '18:30:00',
        'grace_minutes' => 15,
        'half_day_minutes' => 240,
        'full_day_minutes' => 480,
        'is_default' => false,
        'status' => 'active',
    ];

    protected function casts(): array
    {
        return [
            'weekly_offs' => 'array',
            'grace_minutes' => 'integer',
            'half_day_minutes' => 'integer',
            'full_day_minutes' => 'integer',
            'is_default' => 'boolean',
        ];
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function isWeeklyOff(Carbon $date): bool
    {
        return in_array($date->dayOfWeek, $this->weeklyOffDays(), true);
    }

    public function weeklyOffDays(): array
    {
        return array_map('intval', $this->weekly_offs ?? []);
    }

    public function weeklyOffNames(): array
    {
        return array_values(array_map(fn (int $day): string => self::DAYS[$day] ?? (string) $day, $this->weeklyOffDays()));
    }

    public function lateMinutes(Carbon $checkIn): int
    {
        $allowedUntil = $checkIn->copy()
            ->setTimeFromTimeString((string) $this->start_time)
            ->addMinutes($this->grace_minutes);

        return $checkIn->greaterThan($allowedUntil) ? (int) $allowedUntil->diffInMinutes($checkIn) : 0;
    }

    public function statusFor(int $workedMinutes, bool $hasOpenPunch): string
    {
        if ($workedMinutes >= $this->full_day_minutes || $hasOpenPunch) {
            return Attendance::PRESENT;
        }

        if ($workedMinutes >= $this->half_day_minutes) {
            return Attendance::HALF_DAY;
        }

        return $workedMinutes > 0 ? Attendance::HALF_DAY : Attendance::ABSENT;
    }
}

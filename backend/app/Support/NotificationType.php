<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Str;

final class NotificationType
{
    public const LEAVE_APPLIED = 'leave.applied';

    public const LEAVE_APPROVED = 'leave.approved';

    public const LEAVE_REJECTED = 'leave.rejected';

    public const LEAVE_CANCELLED = 'leave.cancelled';

    public const ATTENDANCE_CHECKED_IN = 'attendance.checked_in';

    public const ATTENDANCE_CHECKED_OUT = 'attendance.checked_out';

    public const ATTENDANCE_LATE = 'attendance.late';

    public const DOCUMENT_UPLOADED = 'document.uploaded';

    public const DOCUMENT_VERIFIED = 'document.verified';

    public const DOCUMENT_REJECTED = 'document.rejected';

    public const HOLIDAY_PUBLISHED = 'holiday.published';

    public const TASK_ASSIGNED = 'task.assigned';

    public const TASK_UPDATED = 'task.updated';

    public const TASK_COMMENTED = 'task.commented';

    public const REPORT_SUBMITTED = 'report.submitted';

    public const ANNOUNCEMENT = 'announcement.general';

    public const LOW = 'low';

    public const NORMAL = 'normal';

    public const HIGH = 'high';

    public const PRIORITIES = [self::LOW, self::NORMAL, self::HIGH];

    public const GROUPS = ['leave', 'attendance', 'document', 'task', 'report', 'holiday', 'announcement', 'account'];

    public static function group(string $type): string
    {
        $group = Str::before($type, '.');

        return in_array($group, self::GROUPS, true) ? $group : 'account';
    }

    public static function priority(string $type): string
    {
        return match ($type) {
            self::LEAVE_APPLIED, self::LEAVE_APPROVED, self::LEAVE_REJECTED, self::DOCUMENT_REJECTED,
            self::TASK_ASSIGNED => self::HIGH,
            self::ATTENDANCE_CHECKED_IN, self::ATTENDANCE_CHECKED_OUT, self::REPORT_SUBMITTED => self::LOW,
            default => self::NORMAL,
        };
    }
}

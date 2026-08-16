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

    public const ATTENDANCE_AUTO_CHECKOUT = 'attendance.auto_checkout';

    public const DOCUMENT_EXPIRING = 'document.expiring';

    public const REGULARIZATION_REQUESTED = 'attendance.regularization_requested';

    public const REGULARIZATION_APPROVED = 'attendance.regularization_approved';

    public const REGULARIZATION_REJECTED = 'attendance.regularization_rejected';

    public const DOCUMENT_UPLOADED = 'document.uploaded';

    public const DOCUMENT_VERIFIED = 'document.verified';

    public const DOCUMENT_REJECTED = 'document.rejected';

    public const HOLIDAY_PUBLISHED = 'holiday.published';

    public const TASK_ASSIGNED = 'task.assigned';

    public const TASK_UPDATED = 'task.updated';

    public const TASK_COMMENTED = 'task.commented';

    public const TASK_DUE_SOON = 'task.due_soon';

    public const TASK_OVERDUE = 'task.overdue';

    public const EXPENSE_APPLIED = 'expense.applied';

    public const EXPENSE_APPROVED = 'expense.approved';

    public const EXPENSE_VERIFY_PENDING = 'expense.verify_pending';

    public const EXPENSE_VERIFIED = 'expense.verified';

    public const EXPENSE_PAYMENT_PENDING = 'expense.payment_pending';

    public const EXPENSE_PAID = 'expense.paid';

    public const EXPENSE_REJECTED = 'expense.rejected';

    public const EXIT_APPLIED = 'exit.applied';

    public const EXIT_MANAGER_APPROVED = 'exit.manager_approved';

    public const EXIT_HR_PENDING = 'exit.hr_pending';

    public const EXIT_APPROVED = 'exit.approved';

    public const EXIT_DATE_CHANGED = 'exit.date_changed';

    public const EXIT_REJECTED = 'exit.rejected';

    public const EXIT_WITHDRAWN = 'exit.withdrawn';

    public const EXIT_COMPLETED = 'exit.completed';

    public const EXIT_DOCUMENT_ISSUED = 'exit.document_issued';

    public const CLEARANCE_PENDING = 'exit.clearance_pending';

    public const GOAL_SUBMITTED = 'performance.goal_submitted';

    public const GOAL_APPROVED = 'performance.goal_approved';

    public const GOAL_CLOSED = 'performance.goal_closed';

    public const APPRAISAL_LAUNCHED = 'performance.appraisal_launched';

    public const APPRAISAL_SELF_PENDING = 'performance.self_review_pending';

    public const APPRAISAL_MANAGER_PENDING = 'performance.manager_review_pending';

    public const APPRAISAL_HR_PENDING = 'performance.hr_review_pending';

    public const APPRAISAL_FINALISED = 'performance.appraisal_finalised';

    public const OKR_SUBMITTED = 'performance.okr_submitted';

    public const OKR_VERIFIED = 'performance.okr_verified';

    public const OKR_FINALISED = 'performance.okr_finalised';

    public const INCENTIVE_APPROVED = 'performance.incentive_approved';

    public const RECOGNITION_RECEIVED = 'performance.recognition_received';

    public const ASSET_ALLOCATED = 'asset.allocated';

    public const ASSET_REQUEST_RAISED = 'asset.request_raised';

    public const ASSET_REQUEST_APPROVED = 'asset.request_approved';

    public const ASSET_REQUEST_REJECTED = 'asset.request_rejected';

    public const ASSET_REQUEST_RESOLVED = 'asset.request_resolved';

    public const POLICY_PUBLISHED = 'policy.published';

    public const POLICY_REMINDER = 'policy.reminder';

    public const REPORT_SUBMITTED = 'report.submitted';

    public const SOD_PENDING = 'report.sod_pending';

    public const EOD_PENDING = 'report.eod_pending';

    public const ANNOUNCEMENT = 'announcement.general';

    public const LOW = 'low';

    public const NORMAL = 'normal';

    public const HIGH = 'high';

    public const PRIORITIES = [self::LOW, self::NORMAL, self::HIGH];

    public const GROUPS = ['leave', 'attendance', 'document', 'task', 'report', 'expense', 'exit', 'performance', 'asset', 'policy', 'holiday', 'announcement', 'account'];

    public static function group(string $type): string
    {
        $group = Str::before($type, '.');

        return in_array($group, self::GROUPS, true) ? $group : 'account';
    }

    public static function priority(string $type): string
    {
        return match ($type) {
            self::LEAVE_APPLIED, self::LEAVE_APPROVED, self::LEAVE_REJECTED, self::DOCUMENT_REJECTED,
            self::TASK_ASSIGNED, self::TASK_OVERDUE, self::REGULARIZATION_REQUESTED,
            self::REGULARIZATION_APPROVED, self::REGULARIZATION_REJECTED,
            self::EXPENSE_APPLIED, self::EXPENSE_PAID, self::EXPENSE_REJECTED,
            self::EXIT_APPLIED, self::EXIT_APPROVED, self::EXIT_REJECTED,
            self::EXIT_DATE_CHANGED, self::EXIT_COMPLETED,
            self::APPRAISAL_LAUNCHED, self::APPRAISAL_FINALISED,
            self::ASSET_REQUEST_RAISED, self::POLICY_PUBLISHED, self::POLICY_REMINDER => self::HIGH,
            self::ATTENDANCE_CHECKED_IN, self::ATTENDANCE_CHECKED_OUT, self::REPORT_SUBMITTED => self::LOW,
            default => self::NORMAL,
        };
    }
}

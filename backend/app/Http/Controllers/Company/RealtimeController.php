<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Services\NotificationService;
use App\Support\ApiResponse;
use App\Support\NotificationType;
use App\Support\Realtime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RealtimeController extends ApiController
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function config(Request $request): JsonResponse
    {
        $user = $request->user();

        return ApiResponse::success([
            'connection' => Realtime::connection(),
            'auth_endpoint' => url('api/hrms/broadcasting/auth'),
            'channels' => [
                'personal' => 'private-' . Realtime::userChannel((int) $user->id),
                'company' => $user->company_id === null
                    ? null
                    : 'private-' . Realtime::companyChannel((int) $user->company_id),
            ],
            'events' => [
                'notification.new',
                'notification.read',
                'notification.read_all',
                'notification.deleted',
                'notification.cleared',
                'announcement.new',
                'leave.changed',
                'attendance.changed',
                'regularization.changed',
                'document.changed',
                'task.changed',
                'task.commented',
                'daily_report.changed',
                'expense.changed',
                'holiday.changed',
            ],
            'groups' => NotificationType::GROUPS,
            'unread_count' => $this->notifications->unreadCount($user),
        ], 'Realtime config fetched successfully');
    }
}

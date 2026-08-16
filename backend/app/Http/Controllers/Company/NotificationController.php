<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\NotificationAnnounceRequest;
use App\Http\Requests\NotificationIndexRequest;
use App\Http\Requests\NotificationPreferenceRequest;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Services\NotificationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends ApiController
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function index(NotificationIndexRequest $request): JsonResponse
    {
        $records = $this->applyFilters(
            Notification::query()->forUser($request->user()),
            $request,
            ['title', 'body'],
            ['group' => 'group_name', 'type' => 'type']
        )
            ->when($request->boolean('unread'), fn ($query) => $query->unread())
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($records, NotificationResource::class, 'Notifications fetched successfully');
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->notifications->summary($request->user()),
            'Unread summary fetched successfully'
        );
    }

    public function show(Notification $notification): JsonResponse
    {
        return ApiResponse::success(
            new NotificationResource($notification),
            'Notification fetched successfully'
        );
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        return ApiResponse::success(
            new NotificationResource($this->notifications->markRead($notification, $request->user())),
            'Notification marked as read'
        );
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $group = $request->filled('group') ? $request->string('group')->toString() : null;

        return ApiResponse::success(
            ['marked' => $this->notifications->markAllRead($request->user(), $group)],
            'Notifications marked as read'
        );
    }

    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        $this->notifications->delete($notification, $request->user());

        return ApiResponse::success(null, 'Notification deleted successfully');
    }

    public function clear(Request $request): JsonResponse
    {
        return ApiResponse::success(
            ['deleted' => $this->notifications->clear($request->user(), $request->boolean('only_read'))],
            'Notifications cleared successfully'
        );
    }

    public function announce(NotificationAnnounceRequest $request): JsonResponse
    {
        return ApiResponse::created(
            $this->notifications->announce($request->user(), $request->validated()),
            'Announcement sent successfully'
        );
    }

    public function preferences(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->notifications->preferences($request->user()),
            'Notification preferences fetched successfully'
        );
    }

    public function savePreferences(NotificationPreferenceRequest $request): JsonResponse
    {
        return ApiResponse::success(
            $this->notifications->savePreferences($request->user(), $request->validated('preferences')),
            'Notification preferences updated successfully'
        );
    }
}

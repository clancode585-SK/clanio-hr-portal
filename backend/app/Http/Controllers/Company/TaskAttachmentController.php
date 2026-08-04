<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Requests\TaskAttachmentRequest;
use App\Http\Resources\TaskAttachmentResource;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Services\TaskService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskAttachmentController extends ApiController
{
    public function __construct(private readonly TaskService $tasks) {}

    public function index(Task $task): JsonResponse
    {
        return ApiResponse::success(
            TaskAttachmentResource::collection($task->attachments()->with('uploader')->orderByDesc('id')->get()),
            'Attachments fetched successfully'
        );
    }

    public function store(TaskAttachmentRequest $request, Task $task): JsonResponse
    {
        return ApiResponse::created(
            new TaskAttachmentResource($this->tasks->attach($task, $request->file('file'), $request->user())),
            'File upload ho gayi'
        );
    }

    public function destroy(Request $request, Task $task, TaskAttachment $attachment): JsonResponse
    {
        $this->tasks->deleteAttachment($attachment, $request->user());

        return ApiResponse::success(null, 'File hata di gayi');
    }

    public function download(Request $request, TaskAttachment $attachment): StreamedResponse
    {
        $task = Task::query()->visibleTo($request->user())->whereKey($attachment->task_id)->first();

        if ($task === null) {
            throw new ApiException('Ye file aap nahi dekh sakte.', 404, 'RESOURCE_NOT_FOUND');
        }

        return $this->tasks->downloadAttachment($attachment);
    }
}

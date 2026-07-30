<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\TaskCommentRequest;
use App\Http\Resources\TaskCommentResource;
use App\Models\Task;
use App\Models\TaskComment;
use App\Services\TaskService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskCommentController extends ApiController
{
    public function __construct(private readonly TaskService $tasks) {}

    public function index(Task $task): JsonResponse
    {
        return ApiResponse::success(
            TaskCommentResource::collection($task->comments()->with('author')->orderBy('id')->get()),
            'Comments fetched successfully'
        );
    }

    public function store(TaskCommentRequest $request, Task $task): JsonResponse
    {
        return ApiResponse::created(
            new TaskCommentResource($this->tasks->comment($task, $request->validated(), $request->user())),
            'Comment added successfully'
        );
    }

    public function destroy(Request $request, Task $task, TaskComment $comment): JsonResponse
    {
        $this->tasks->deleteComment($comment, $request->user());

        return ApiResponse::success(null, 'Comment deleted successfully');
    }
}

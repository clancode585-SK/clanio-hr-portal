<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\TaskRequest;
use App\Http\Requests\TaskStatusRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Services\TaskService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends ApiController
{
    public function __construct(private readonly TaskService $tasks) {}

    public function index(Request $request): JsonResponse
    {
        $records = $this->scoped($request)->paginate($this->perPage($request));

        return ApiResponse::paginated($records, TaskResource::class, 'Tasks fetched successfully');
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->tasks->summaryFor($request->user()),
            'Task summary fetched successfully'
        );
    }

    public function store(TaskRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new TaskResource($this->tasks->create($request->validated(), $request->user())),
            'Task created successfully'
        );
    }

    public function show(Task $task): JsonResponse
    {
        $task->load(['assignee', 'assigner', 'parent', 'comments.author', 'attachments.uploader'])
            ->load(['subtasks' => fn ($query) => $query->with('assignee')->orderBy('id')])
            ->loadCount(['comments', 'attachments', 'subtasks']);

        return ApiResponse::success(new TaskResource($task), 'Task fetched successfully');
    }

    public function activity(Task $task): JsonResponse
    {
        return ApiResponse::success(
            $this->tasks->activity($task),
            'Task activity fetched successfully'
        );
    }

    public function update(TaskRequest $request, Task $task): JsonResponse
    {
        return ApiResponse::success(
            new TaskResource($this->tasks->update($task, $request->validated(), $request->user())),
            'Task updated successfully'
        );
    }

    public function changeStatus(TaskStatusRequest $request, Task $task): JsonResponse
    {
        return ApiResponse::success(
            new TaskResource($this->tasks->changeStatus($task, $request->validated(), $request->user())),
            'Task status updated successfully'
        );
    }

    public function destroy(Request $request, Task $task): JsonResponse
    {
        $this->tasks->delete($task, $request->user());

        return ApiResponse::success(null, 'Task deleted successfully');
    }

    private function scoped(Request $request): Builder
    {
        return $this->applyFilters(
            Task::query()
                ->with(['assignee', 'assigner'])
                ->withCount(['comments', 'attachments', 'subtasks'])
                ->when(! $request->boolean('include_subtasks'), fn (Builder $query) => $query->roots())
                ->when($request->filled('parent_id'), fn (Builder $query) => $query->where('parent_id', $request->integer('parent_id')))
                ->visibleTo($request->user()),
            $request,
            ['title', 'description'],
            [
                'status' => 'status',
                'priority' => 'priority',
                'assignee_id' => 'assignee_id',
                'assigned_by' => 'assigned_by',
            ]
        )
            ->when($request->boolean('open'), fn (Builder $query) => $query->open())
            ->when($request->boolean('overdue'), fn (Builder $query) => $query->overdue())
            ->when($request->boolean('mine'), fn (Builder $query) => $query->where('assignee_id', $request->user()->id))
            ->when($request->filled('due_from'), fn (Builder $query) => $query->whereDate('due_date', '>=', $request->date('due_from')))
            ->when($request->filled('due_to'), fn (Builder $query) => $query->whereDate('due_date', '<=', $request->date('due_to')))
            ->orderByRaw("FIELD(status, 'blocked', 'in_progress', 'todo', 'done', 'cancelled')")
            ->orderByRaw("FIELD(priority, 'urgent', 'high', 'normal', 'low')")
            ->orderByRaw('due_date IS NULL, due_date')
            ->orderByDesc('id');
    }
}

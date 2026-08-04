<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\TaskComment;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Realtime;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class TaskService
{
    private const DISK = 'local';

    private const ALLOWED_MOVES = [
        Task::TODO => [Task::IN_PROGRESS, Task::BLOCKED, Task::DONE, Task::CANCELLED],
        Task::IN_PROGRESS => [Task::TODO, Task::BLOCKED, Task::DONE, Task::CANCELLED],
        Task::BLOCKED => [Task::TODO, Task::IN_PROGRESS, Task::DONE, Task::CANCELLED],
        Task::DONE => [Task::IN_PROGRESS],
        Task::CANCELLED => [Task::TODO],
    ];

    public function __construct(private readonly NotificationService $notifications) {}

    public function create(array $data, User $actor): Task
    {
        $assignee = $this->assignee($data, $actor);
        $parent = $this->parentFor($data, $actor);

        $task = DB::transaction(function () use ($data, $actor, $assignee, $parent): Task {
            $task = new Task($data);
            $task->company_id = $assignee->company_id;
            $task->parent_id = $parent?->id;
            $task->assignee_id = $assignee->id;
            $task->assigned_by = $actor->id;
            $task->created_by = $actor->id;
            $task->save();

            $this->flush();

            return $task->refresh()->load('assignee', 'assigner');
        });

        if ((int) $assignee->id !== (int) $actor->id) {
            $this->notifyAssignee($task, $actor);
        }

        $this->broadcast($task, 'created');

        return $task;
    }

    public function update(Task $task, array $data, User $actor): Task
    {
        $this->assertCanEdit($task, $actor);

        $reassigned = false;

        $task = DB::transaction(function () use ($task, $data, $actor, &$reassigned): Task {
            if (array_key_exists('assignee_id', $data)) {
                $assignee = $this->assignee($data, $actor);

                if ((int) $assignee->id !== (int) $task->assignee_id) {
                    $this->assertCanReassign($task, $actor);
                    $task->assignee_id = $assignee->id;
                    $reassigned = true;
                }
            }

            $task->fill($data);
            $task->updated_by = $actor->id;
            $task->save();

            $this->flush();

            return $task->refresh()->load('assignee', 'assigner');
        });

        if ($reassigned) {
            $this->notifyAssignee($task, $actor);
        }

        $this->broadcast($task, 'updated');

        return $task;
    }

    public function changeStatus(Task $task, array $data, User $actor): Task
    {
        $this->assertCanEdit($task, $actor);

        $target = (string) $data['status'];
        $current = (string) $task->status;

        if ($target === $current) {
            return $task->load('assignee', 'assigner');
        }

        $this->assertMoveAllowed($current, $target);

        if ($target === Task::BLOCKED && ($data['blocked_reason'] ?? null) === null) {
            throw new ApiException('Blocked karne ke liye reason likhna zaroori hai.', 422, 'TASK_REASON_REQUIRED');
        }

        if ($target === Task::DONE) {
            $open = $task->subtasks()->open()->count();

            if ($open > 0) {
                throw new ApiException(
                    $open . ' subtask abhi khuli hai — pehle unhe pura karo.',
                    409,
                    'TASK_SUBTASKS_OPEN'
                );
            }
        }

        $task = DB::transaction(function () use ($task, $data, $actor, $target): Task {
            $now = Carbon::now();

            $task->forceFill([
                'status' => $target,
                'blocked_reason' => $target === Task::BLOCKED ? $data['blocked_reason'] : null,
                'started_at' => $task->started_at ?? ($target === Task::IN_PROGRESS ? $now : null),
                'completed_at' => $target === Task::DONE ? $now : null,
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();

            return $task->refresh()->load('assignee', 'assigner');
        });

        $this->notifyStatus($task, $actor, $current);
        $this->broadcast($task, 'status_changed');

        return $task;
    }

    public function delete(Task $task, User $actor): void
    {
        if (! $task->isOwnedBy($actor) && ! $actor->isSuperAdmin() && ! $actor->hasPermission(Task::DELETE_PERMISSION)) {
            throw new ApiException('Ye task delete karne ki permission nahi hai.', 403, 'FORBIDDEN');
        }

        if ($task->status === Task::DONE && ! $actor->isSuperAdmin() && ! $actor->hasPermission(Task::DELETE_PERMISSION)) {
            throw new ApiException(
                'Complete task delete nahi hoti. Manager se karwao.',
                409,
                'TASK_ALREADY_DONE'
            );
        }

        DB::transaction(function () use ($task): void {
            $task->delete();
            $this->flush();
        });

        $this->broadcast($task, 'deleted');
    }

    public function comment(Task $task, array $data, User $actor): TaskComment
    {
        $comment = new TaskComment($data);
        $comment->company_id = $task->company_id;
        $comment->task_id = $task->id;
        $comment->user_id = $actor->id;
        $comment->created_by = $actor->id;
        $comment->save();

        $this->notifyComment($task, $comment, $actor);

        return $comment->refresh()->load('author');
    }

    public function deleteComment(TaskComment $comment, User $actor): void
    {
        if (! $comment->isAuthor($actor) && ! $actor->isSuperAdmin() && ! $actor->hasPermission(Task::EDIT_PERMISSION)) {
            throw new ApiException('Sirf apna comment delete kar sakte ho.', 403, 'FORBIDDEN');
        }

        $comment->delete();
    }

    public function attach(Task $task, UploadedFile $file, User $actor): TaskAttachment
    {
        $this->assertCanEdit($task, $actor);

        return DB::transaction(function () use ($task, $file, $actor): TaskAttachment {
            $path = $file->storeAs(
                'tasks/' . $task->company_id . '/' . $task->id,
                Str::uuid()->toString() . '.' . strtolower($file->getClientOriginalExtension() ?: 'bin'),
                self::DISK
            );

            $attachment = new TaskAttachment([
                'file_path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size_bytes' => $file->getSize() ?: 0,
            ]);

            $attachment->company_id = $task->company_id;
            $attachment->task_id = $task->id;
            $attachment->uploaded_by = $actor->id;
            $attachment->created_by = $actor->id;
            $attachment->save();

            $this->flush();

            return $attachment->refresh()->load('uploader');
        });
    }

    public function deleteAttachment(TaskAttachment $attachment, User $actor): void
    {
        if (! $attachment->isUploader($actor) && ! $actor->isSuperAdmin() && ! $actor->hasPermission(Task::EDIT_PERMISSION)) {
            throw new ApiException('Sirf apni upload ki hui file hata sakte ho.', 403, 'FORBIDDEN');
        }

        DB::transaction(function () use ($attachment): void {
            if (Storage::disk(self::DISK)->exists($attachment->file_path)) {
                Storage::disk(self::DISK)->delete($attachment->file_path);
            }

            $attachment->delete();
            $this->flush();
        });
    }

    public function downloadAttachment(TaskAttachment $attachment): StreamedResponse
    {
        if (! Storage::disk(self::DISK)->exists($attachment->file_path)) {
            throw new ApiException('Ye file ab available nahi hai.', 404, 'FILE_MISSING');
        }

        return Storage::disk(self::DISK)->download($attachment->file_path, $attachment->original_name);
    }

    public function activity(Task $task): array
    {
        return AuditLog::query()
            ->where('auditable_type', 'Task')
            ->where('auditable_id', $task->id)
            ->with([])
            ->orderByDesc('id')
            ->limit(60)
            ->get(['id', 'user_id', 'event', 'old_values', 'new_values', 'created_at'])
            ->map(function (AuditLog $log) use ($task): array {
                $actor = $log->user_id === null ? null : User::query()
                    ->withoutGlobalScope(CompanyScope::class)
                    ->whereKey($log->user_id)
                    ->value('name');

                return [
                    'id' => (int) $log->id,
                    'event' => $log->event,
                    'actor_id' => $log->user_id === null ? null : (int) $log->user_id,
                    'actor_name' => $actor,
                    'changes' => $this->describe($log, $task),
                    'created_at' => $log->created_at,
                ];
            })
            ->all();
    }

    public function summaryFor(User $actor): array
    {
        $rows = Task::query()
            ->where('assignee_id', $actor->id)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        $byStatus = [];

        foreach (Task::STATUSES as $status) {
            $byStatus[$status] = (int) ($rows[$status] ?? 0);
        }

        return [
            'assigned_to_me' => array_sum($byStatus),
            'open' => $byStatus[Task::TODO] + $byStatus[Task::IN_PROGRESS] + $byStatus[Task::BLOCKED],
            'overdue' => Task::query()->where('assignee_id', $actor->id)->overdue()->count(),
            'due_today' => Task::query()
                ->where('assignee_id', $actor->id)
                ->open()
                ->whereDate('due_date', Carbon::today())
                ->count(),
            'by_status' => $byStatus,
        ];
    }

    public function adjustSpentHours(int $taskId, float $delta): void
    {
        if ($delta === 0.0) {
            return;
        }

        $task = Task::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->whereKey($taskId)
            ->first(['id', 'spent_hours']);

        if ($task === null) {
            return;
        }

        $task->forceFill([
            'spent_hours' => max(0, round((float) $task->spent_hours + $delta, 1)),
        ])->saveQuietly();
    }

    private function describe(AuditLog $log, Task $task): array
    {
        $labels = [
            'status' => 'Status',
            'priority' => 'Priority',
            'assignee_id' => 'Assignee',
            'due_date' => 'Due date',
            'title' => 'Title',
            'blocked_reason' => 'Blocked reason',
            'estimated_hours' => 'Estimate',
            'spent_hours' => 'Spent hours',
        ];

        if ($log->event === 'created') {
            return [['field' => 'Task', 'from' => null, 'to' => $task->title]];
        }

        $changes = [];

        foreach (($log->new_values ?? []) as $field => $value) {
            if (! isset($labels[$field])) {
                continue;
            }

            $changes[] = [
                'field' => $labels[$field],
                'from' => $log->old_values[$field] ?? null,
                'to' => $value,
            ];
        }

        return $changes;
    }

    private function parentFor(array $data, User $actor): ?Task
    {
        $parentId = isset($data['parent_id']) ? (int) $data['parent_id'] : null;

        if ($parentId === null) {
            return null;
        }

        $parent = Task::query()->visibleTo($actor)->whereKey($parentId)->first();

        if ($parent === null) {
            throw new ApiException('Parent task nahi mila.', 422, 'TASK_PARENT_INVALID');
        }

        if ($parent->isSubtask()) {
            throw new ApiException(
                'Subtask ke andar subtask nahi banti — sirf ek level chalega.',
                422,
                'TASK_NESTING_LIMIT'
            );
        }

        if ($parent->isClosed()) {
            throw new ApiException('Band task mein subtask nahi jud sakti.', 409, 'TASK_PARENT_CLOSED');
        }

        return $parent;
    }

    private function assignee(array $data, User $actor): User
    {
        $assigneeId = isset($data['assignee_id']) ? (int) $data['assignee_id'] : (int) $actor->id;

        if ($assigneeId === (int) $actor->id) {
            return $actor;
        }

        $assignee = User::query()->visibleTo($actor)->whereKey($assigneeId)->first()
            ?? $this->directReport($actor, $assigneeId);

        if ($assignee === null) {
            throw new ApiException(
                'Is user ko task assign nahi kar sakte — na aapke scope mein hai, na aapko report karta hai.',
                422,
                'TASK_ASSIGNEE_INVALID'
            );
        }

        if (! $assignee->isActive()) {
            throw new ApiException('Ye user active nahi hai.', 422, 'TASK_ASSIGNEE_INACTIVE');
        }

        return $assignee;
    }

    private function directReport(User $actor, int $userId): ?User
    {
        $reportsToActor = Employee::query()
            ->where('user_id', $userId)
            ->where('reporting_manager_id', $actor->id)
            ->exists();

        return $reportsToActor ? User::query()->whereKey($userId)->first() : null;
    }

    private function assertCanEdit(Task $task, User $actor): void
    {
        if ($task->isOwnedBy($actor) || $actor->isSuperAdmin() || $actor->hasPermission(Task::EDIT_PERMISSION)) {
            return;
        }

        throw new ApiException('Ye task edit karne ki permission nahi hai.', 403, 'FORBIDDEN');
    }

    private function assertCanReassign(Task $task, User $actor): void
    {
        if ((int) $task->assigned_by === (int) $actor->id
            || $actor->isSuperAdmin()
            || $actor->hasPermission(Task::EDIT_PERMISSION)) {
            return;
        }

        throw new ApiException(
            'Task dusre ko transfer karne ka haq sirf assign karne wale ka hai.',
            403,
            'TASK_REASSIGN_FORBIDDEN'
        );
    }

    private function assertMoveAllowed(string $current, string $target): void
    {
        if (in_array($target, self::ALLOWED_MOVES[$current] ?? [], true)) {
            return;
        }

        throw new ApiException(
            $current . ' se ' . $target . ' par nahi ja sakte.',
            422,
            'TASK_STATUS_INVALID'
        );
    }

    private function notifyAssignee(Task $task, User $actor): void
    {
        $this->notifications->send((int) $task->assignee_id, [
            'type' => NotificationType::TASK_ASSIGNED,
            'title' => 'Naya task mila: ' . $task->title,
            'body' => $this->summary($task),
            'action_url' => '/tasks/' . $task->uuid,
            'entity_type' => 'task',
            'entity_id' => $task->id,
            'payload' => $this->payload($task),
            'dedupe_key' => 'task:' . $task->id . ':assigned',
        ], $actor);
    }

    private function notifyStatus(Task $task, User $actor, string $from): void
    {
        $watchers = [(int) $task->assignee_id, (int) $task->assigned_by];
        $recipients = array_values(array_filter(
            array_unique($watchers),
            fn (int $id): bool => $id > 0 && $id !== (int) $actor->id
        ));

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::TASK_UPDATED,
            'title' => $task->title . ' → ' . $task->status,
            'body' => $actor->name . ' ne status ' . $from . ' se ' . $task->status . ' kiya.'
                . ($task->blocked_reason === null ? '' : ' Reason: ' . $task->blocked_reason),
            'action_url' => '/tasks/' . $task->uuid,
            'entity_type' => 'task',
            'entity_id' => $task->id,
            'payload' => $this->payload($task),
        ], $actor);
    }

    private function notifyComment(Task $task, TaskComment $comment, User $actor): void
    {
        $watchers = [(int) $task->assignee_id, (int) $task->assigned_by];
        $recipients = array_values(array_filter(
            array_unique($watchers),
            fn (int $id): bool => $id > 0 && $id !== (int) $actor->id
        ));

        if ($recipients !== []) {
            $this->notifications->sendMany($recipients, [
                'type' => NotificationType::TASK_COMMENTED,
                'title' => $actor->name . ' ne comment kiya',
                'body' => mb_substr($comment->body, 0, 180),
                'action_url' => '/tasks/' . $task->uuid,
                'entity_type' => 'task',
                'entity_id' => $task->id,
                'payload' => $this->payload($task),
            ], $actor);
        }

        Realtime::toUsers(array_merge($recipients, [(int) $actor->id]), 'task.commented', [
            'task_id' => (int) $task->id,
            'comment_id' => (int) $comment->id,
            'author_id' => (int) $actor->id,
            'author_name' => $actor->name,
            'body' => $comment->body,
        ]);
    }

    private function broadcast(Task $task, string $action): void
    {
        Realtime::toUsers(
            [(int) $task->assignee_id, (int) $task->assigned_by],
            'task.changed',
            ['action' => $action] + $this->payload($task)
        );
    }

    private function payload(Task $task): array
    {
        return [
            'task_id' => (int) $task->id,
            'task_uuid' => $task->uuid,
            'title' => $task->title,
            'status' => $task->status,
            'priority' => $task->priority,
            'assignee_id' => (int) $task->assignee_id,
            'assignee_name' => $task->assignee?->name,
            'due_date' => $task->due_date?->toDateString(),
            'is_overdue' => $task->isOverdue(),
        ];
    }

    private function summary(Task $task): string
    {
        $parts = [ucfirst($task->priority) . ' priority'];

        if ($task->due_date !== null) {
            $parts[] = 'due ' . $task->due_date->format('d M Y');
        }

        if ($task->estimated_hours !== null) {
            $parts[] = $task->estimated_hours . ' ghante ka estimate';
        }

        return implode(' · ', $parts);
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::TASKS);
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\TicketCategoryRoute;
use App\Models\TicketComment;
use App\Models\User;
use App\Support\BusinessHours;
use App\Support\NotificationType;
use App\Support\Recipients;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class TicketService
{
    private const RELATIONS = ['category', 'route', 'raiser', 'assignee', 'department', 'resolver'];

    public function __construct(private readonly NotificationService $notifications) {}

    public function raise(User $actor, array $data): Ticket
    {
        $category = $this->category($actor, (int) $data['category_id']);
        $route = $this->route($category, isset($data['route_id']) ? (int) $data['route_id'] : null);

        if ($category->isPlatform() && ! $actor->hasPermission(Ticket::PLATFORM_PERMISSION)) {
            throw new ApiException(
                'Clanio support ko ticket sirf company admin bhej sakta hai.',
                403,
                'TICKET_PLATFORM_FORBIDDEN'
            );
        }

        $priority = (string) ($data['priority'] ?? $category->default_priority);
        $target = $this->resolveTarget($actor, $route);
        $sla = $this->sla((int) $actor->company_id, $priority, $category);
        $now = Carbon::now();
        $calendar = BusinessHours::calendarFor((int) $actor->company_id);

        $ticket = DB::transaction(function () use ($actor, $category, $route, $data, $priority, $target, $sla, $now, $calendar): Ticket {
            $ticket = new Ticket([
                'subject' => $data['subject'],
                'message' => $data['message'],
                'priority' => $priority,
            ]);

            $ticket->company_id = $actor->company_id;
            $ticket->ticket_no = $this->nextNumber((int) $actor->company_id, $now);
            $ticket->scope = $category->scope;
            $ticket->category_id = $category->id;
            $ticket->route_id = $route->id;
            $ticket->route_to = $route->route_to;
            $ticket->raised_by = $actor->id;
            $ticket->assigned_to = $target['user_id'];
            $ticket->assigned_department_id = $target['department_id'];
            $ticket->first_response_due_at = $sla['response_hours'] === null
                ? null
                : BusinessHours::add($calendar, $now, $sla['response_hours'] * 60);
            $ticket->resolution_due_at = $sla['resolution_hours'] === null
                ? null
                : BusinessHours::add($calendar, $now, $sla['resolution_hours'] * 60);
            $ticket->created_by = $actor->id;
            $ticket->save();

            $this->flush();

            return $ticket->refresh()->load(self::RELATIONS);
        });

        $this->notify(
            $ticket,
            $target['notify'],
            $actor,
            NotificationType::TICKET_RAISED,
            'Nayi request aayi hai',
            $ticket->ticket_no . ' — ' . $ticket->subject
        );

        return $ticket;
    }

    public function claim(Ticket $ticket, User $actor): Ticket
    {
        $this->assertHandler($ticket, $actor);

        if (! $ticket->isOpenStage()) {
            throw new ApiException('Ye ticket ab ' . $ticket->stageLabel() . ' — assign nahi ho sakta.', 409, 'TICKET_WRONG_STAGE');
        }

        $ticket->forceFill([
            'assigned_to' => $actor->id,
            'status' => $ticket->isWaiting() ? $ticket->status : Ticket::IN_PROGRESS,
            'updated_by' => $actor->id,
        ])->save();

        $ticket = $this->fresh($ticket);

        $this->notify(
            $ticket,
            [(int) $ticket->raised_by],
            $actor,
            NotificationType::TICKET_ASSIGNED,
            'Aapki request kisi ne uthayi',
            $ticket->ticket_no . ' — ' . $actor->name . ' dekh raha hai.'
        );

        return $ticket;
    }

    public function assign(Ticket $ticket, User $actor, int $userId): Ticket
    {
        $this->assertPermission($actor, Ticket::ASSIGN_PERMISSION, 'ticket kisi aur ko dene');

        if (! $ticket->isOpenStage()) {
            throw new ApiException('Ye ticket ab ' . $ticket->stageLabel() . ' — assign nahi ho sakta.', 409, 'TICKET_WRONG_STAGE');
        }

        $assignee = User::query()->whereKey($userId)->first();

        if ($assignee === null) {
            throw new ApiException('Jise assign kar rahe ho wo mila nahi.', 404, 'NOT_FOUND');
        }

        $ticket->forceFill([
            'assigned_to' => $assignee->id,
            'status' => $ticket->isWaiting() ? $ticket->status : Ticket::IN_PROGRESS,
            'updated_by' => $actor->id,
        ])->save();

        $ticket = $this->fresh($ticket);

        $this->notify(
            $ticket,
            [(int) $assignee->id],
            $actor,
            NotificationType::TICKET_ASSIGNED,
            'Ek ticket aapke naam par hai',
            $ticket->ticket_no . ' — ' . $ticket->subject
        );

        return $ticket;
    }

    public function comment(Ticket $ticket, User $actor, array $data): TicketComment
    {
        if ($ticket->isFinished()) {
            throw new ApiException('Band ticket par reply nahi kar sakte.', 409, 'TICKET_CLOSED');
        }

        $internal = (bool) ($data['is_internal'] ?? false);

        if ($internal && $ticket->isRaiser($actor) && ! $this->canHandle($ticket, $actor)) {
            throw new ApiException('Internal note sirf handle karne wala likh sakta hai.', 403, 'TICKET_INTERNAL_FORBIDDEN');
        }

        $comment = DB::transaction(function () use ($ticket, $actor, $data, $internal): TicketComment {
            $comment = new TicketComment([
                'body' => $data['body'],
                'is_internal' => $internal,
            ]);

            $comment->company_id = $ticket->company_id;
            $comment->ticket_id = $ticket->id;
            $comment->user_id = $actor->id;
            $comment->created_by = $actor->id;
            $comment->save();

            $this->afterComment($ticket, $actor);
            $this->flush();

            return $comment->refresh()->load('author');
        });

        if (! $internal) {
            $this->notify(
                $ticket->refresh(),
                $this->counterparts($ticket, $actor),
                $actor,
                NotificationType::TICKET_REPLIED,
                'Ticket par naya reply',
                $ticket->ticket_no . ' — ' . $actor->name
            );
        }

        return $comment;
    }

    public function askInfo(Ticket $ticket, User $actor, array $data): Ticket
    {
        $this->assertHandler($ticket, $actor);

        if (! in_array($ticket->status, [Ticket::OPEN, Ticket::IN_PROGRESS], true)) {
            throw new ApiException('Abhi ' . $ticket->stageLabel() . ' — info nahi maang sakte.', 409, 'TICKET_WRONG_STAGE');
        }

        DB::transaction(function () use ($ticket, $actor, $data): void {
            $comment = new TicketComment(['body' => $data['body']]);
            $comment->company_id = $ticket->company_id;
            $comment->ticket_id = $ticket->id;
            $comment->user_id = $actor->id;
            $comment->created_by = $actor->id;
            $comment->save();

            $ticket->forceFill([
                'status' => Ticket::WAITING_ON_USER,
                'waiting_since' => Carbon::now(),
                'first_responded_at' => $ticket->first_responded_at ?? Carbon::now(),
                'assigned_to' => $ticket->assigned_to ?? $actor->id,
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();
        });

        $ticket = $this->fresh($ticket);

        $this->notify(
            $ticket,
            [(int) $ticket->raised_by],
            $actor,
            NotificationType::TICKET_INFO_NEEDED,
            'Aapse kuch information chahiye',
            $ticket->ticket_no . ' — ' . $data['body']
        );

        return $ticket;
    }

    public function resolve(Ticket $ticket, User $actor, array $data): Ticket
    {
        $this->assertHandler($ticket, $actor);

        if (! $ticket->isOpenStage()) {
            throw new ApiException('Ye ticket ab ' . $ticket->stageLabel() . '.', 409, 'TICKET_WRONG_STAGE');
        }

        $now = Carbon::now();

        DB::transaction(function () use ($ticket, $actor, $data, $now): void {
            $this->resumeClock($ticket, $now);

            $ticket->forceFill([
                'status' => Ticket::RESOLVED,
                'resolution_note' => $data['resolution_note'],
                'resolved_at' => $now,
                'resolved_by' => $actor->id,
                'assigned_to' => $ticket->assigned_to ?? $actor->id,
                'first_responded_at' => $ticket->first_responded_at ?? $now,
                'resolution_breached' => $ticket->resolution_due_at !== null && $now->greaterThan($ticket->resolution_due_at),
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();
        });

        $ticket = $this->fresh($ticket);

        $this->notify(
            $ticket,
            [(int) $ticket->raised_by],
            $actor,
            NotificationType::TICKET_RESOLVED,
            'Aapki request solve ho gayi',
            $ticket->ticket_no . ' — ' . $data['resolution_note']
        );

        return $ticket;
    }

    public function reopen(Ticket $ticket, User $actor, array $data): Ticket
    {
        if (! $ticket->isRaiser($actor)) {
            throw new ApiException('Ticket sirf raise karne wala reopen kar sakta hai.', 403, 'TICKET_NOT_RAISER');
        }

        if (! $ticket->canReopen()) {
            throw new ApiException(
                'Reopen ki ' . Ticket::REOPEN_WINDOW_DAYS . ' din ki window nikal gayi — nayi request banao.',
                409,
                'TICKET_REOPEN_WINDOW_OVER'
            );
        }

        $now = Carbon::now();
        $sla = $this->sla((int) $ticket->company_id, (string) $ticket->priority, $ticket->category);
        $calendar = BusinessHours::calendarFor((int) $ticket->company_id);

        DB::transaction(function () use ($ticket, $actor, $data, $now, $sla, $calendar): void {
            $comment = new TicketComment(['body' => $data['body']]);
            $comment->company_id = $ticket->company_id;
            $comment->ticket_id = $ticket->id;
            $comment->user_id = $actor->id;
            $comment->created_by = $actor->id;
            $comment->save();

            $ticket->forceFill([
                'status' => Ticket::IN_PROGRESS,
                'reopened_at' => $now,
                'reopen_count' => $ticket->reopen_count + 1,
                'resolved_at' => null,
                'resolved_by' => null,
                'resolution_note' => null,
                'resolution_due_at' => $sla['resolution_hours'] === null
                    ? null
                    : BusinessHours::add($calendar, $now, $sla['resolution_hours'] * 60),
                'resolution_breached' => false,
                'updated_by' => $actor->id,
            ])->save();

            $this->flush();
        });

        $ticket = $this->fresh($ticket);

        $this->notify(
            $ticket,
            $this->counterparts($ticket, $actor),
            $actor,
            NotificationType::TICKET_REOPENED,
            'Ticket dobara khul gaya',
            $ticket->ticket_no . ' — ' . $data['body']
        );

        return $ticket;
    }

    public function close(Ticket $ticket, User $actor): Ticket
    {
        if (! $ticket->isRaiser($actor) && ! $actor->hasPermission(Ticket::RESOLVE_PERMISSION)) {
            throw new ApiException('Ticket band karne ka haq raise karne wale ka hai.', 403, 'TICKET_NOT_RAISER');
        }

        if ($ticket->status !== Ticket::RESOLVED) {
            throw new ApiException('Pehle resolve hona chahiye, phir band hoga.', 409, 'TICKET_NOT_RESOLVED');
        }

        $ticket->forceFill([
            'status' => Ticket::CLOSED,
            'closed_at' => Carbon::now(),
            'closed_by' => $actor->id,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $ticket = $this->fresh($ticket);

        $this->notify(
            $ticket,
            $this->counterparts($ticket, $actor),
            $actor,
            NotificationType::TICKET_CLOSED,
            'Ticket band ho gaya',
            $ticket->ticket_no . ' — ' . $ticket->subject
        );

        return $ticket;
    }

    public function cancel(Ticket $ticket, User $actor): Ticket
    {
        if (! $ticket->isRaiser($actor)) {
            throw new ApiException('Sirf raise karne wala apni request cancel kar sakta hai.', 403, 'TICKET_NOT_RAISER');
        }

        if (! $ticket->isOpenStage()) {
            throw new ApiException('Ye ticket ab ' . $ticket->stageLabel() . ' — cancel nahi hoga.', 409, 'TICKET_WRONG_STAGE');
        }

        $ticket->forceFill([
            'status' => Ticket::CANCELLED,
            'cancelled_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $this->fresh($ticket);
    }

    public function escalateOverdue(): int
    {
        $now = Carbon::now();

        $overdue = Ticket::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->whereIn('status', [Ticket::OPEN, Ticket::IN_PROGRESS])
            ->where('resolution_breached', 0)
            ->whereNotNull('resolution_due_at')
            ->where('resolution_due_at', '<', $now)
            ->with('category')
            ->get();

        foreach ($overdue as $ticket) {
            $ticket->forceFill([
                'resolution_breached' => true,
                'escalated_at' => $now,
            ])->save();

            $recipients = Recipients::except(
                Recipients::withPermission((int) $ticket->company_id, Ticket::VIEW_ALL_PERMISSION),
                [(int) $ticket->raised_by]
            );

            $this->notifications->sendMany($recipients, [
                'type' => NotificationType::TICKET_BREACHED,
                'title' => 'Ticket time se late ho gaya',
                'body' => $ticket->ticket_no . ' — ' . $ticket->subject,
                'action_url' => '/tickets/' . $ticket->uuid,
                'meta' => ['ticket_id' => (int) $ticket->id, 'ticket_no' => $ticket->ticket_no],
            ]);
        }

        $this->flush();

        return $overdue->count();
    }

    public function summary(User $actor): array
    {
        $base = fn () => Ticket::query()->visibleTo($actor);

        return [
            'open' => (clone $base())->where('status', Ticket::OPEN)->count(),
            'in_progress' => (clone $base())->where('status', Ticket::IN_PROGRESS)->count(),
            'waiting_on_user' => (clone $base())->where('status', Ticket::WAITING_ON_USER)->count(),
            'resolved' => (clone $base())->where('status', Ticket::RESOLVED)->count(),
            'breached' => (clone $base())->where('resolution_breached', 1)->whereIn('status', [Ticket::OPEN, Ticket::IN_PROGRESS])->count(),
            'raised_by_me' => (clone $base())->where('raised_by', $actor->id)->whereIn('status', [Ticket::OPEN, Ticket::IN_PROGRESS, Ticket::WAITING_ON_USER, Ticket::RESOLVED])->count(),
            'assigned_to_me' => (clone $base())->where('assigned_to', $actor->id)->whereIn('status', [Ticket::OPEN, Ticket::IN_PROGRESS, Ticket::WAITING_ON_USER])->count(),
        ];
    }

    private function afterComment(Ticket $ticket, User $actor): void
    {
        $now = Carbon::now();
        $changes = [];

        if ($ticket->first_responded_at === null && ! $ticket->isRaiser($actor)) {
            $changes['first_responded_at'] = $now;
            $changes['response_breached'] = $ticket->first_response_due_at !== null
                && $now->greaterThan($ticket->first_response_due_at);
        }

        if ($ticket->isWaiting() && $ticket->isRaiser($actor)) {
            $this->resumeClock($ticket, $now);
            $changes['status'] = Ticket::IN_PROGRESS;
        }

        if ($changes !== []) {
            $ticket->forceFill($changes + ['updated_by' => $actor->id])->save();
        }
    }

    private function resumeClock(Ticket $ticket, Carbon $now): void
    {
        if ($ticket->waiting_since === null) {
            return;
        }

        $calendar = BusinessHours::calendarFor((int) $ticket->company_id);
        $paused = BusinessHours::between($calendar, $ticket->waiting_since, $now);

        $ticket->forceFill([
            'paused_minutes' => (int) $ticket->paused_minutes + $paused,
            'waiting_since' => null,
            'resolution_due_at' => $ticket->resolution_due_at === null
                ? null
                : BusinessHours::add($calendar, $ticket->resolution_due_at, $paused),
        ]);
    }

    private function resolveTarget(User $actor, TicketCategoryRoute $route): array
    {
        if ($route->route_to === TicketCategoryRoute::TO_SUPER_ADMIN) {
            return [
                'user_id' => null,
                'department_id' => null,
                'notify' => $this->superAdmins(),
            ];
        }

        if ($route->route_to === TicketCategoryRoute::TO_MANAGER) {
            $managerId = $this->managerOf($actor);

            if ($managerId === null) {
                return $this->fallback($actor);
            }

            return ['user_id' => $managerId, 'department_id' => null, 'notify' => [$managerId]];
        }

        if ($route->route_to === TicketCategoryRoute::TO_USER) {
            $userId = $route->user_id === null ? null : (int) $route->user_id;

            return $userId === null
                ? $this->fallback($actor)
                : ['user_id' => $userId, 'department_id' => null, 'notify' => [$userId]];
        }

        $departmentId = $route->department_id === null ? null : (int) $route->department_id;

        if ($departmentId === null) {
            return $this->fallback($actor);
        }

        $members = Recipients::except(
            Recipients::activeUsers((int) $actor->company_id, ['department_id' => $departmentId]),
            [(int) $actor->id]
        );

        if ($members === []) {
            return $this->fallback($actor);
        }

        return ['user_id' => null, 'department_id' => $departmentId, 'notify' => $members];
    }

    private function fallback(User $actor): array
    {
        $recipients = Recipients::except(
            Recipients::withPermission((int) $actor->company_id, Ticket::VIEW_ALL_PERMISSION),
            [(int) $actor->id]
        );

        return ['user_id' => null, 'department_id' => null, 'notify' => $recipients];
    }

    private function managerOf(User $actor): ?int
    {
        $managerId = DB::table('employees')
            ->where('user_id', $actor->id)
            ->where('is_active', 1)
            ->value('reporting_manager_id');

        return $managerId === null ? null : (int) $managerId;
    }

    private function superAdmins(): array
    {
        return DB::table('users')
            ->where('is_super_admin', 1)
            ->where('is_active', 1)
            ->where('status', 'active')
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    private function counterparts(Ticket $ticket, User $actor): array
    {
        $ids = [(int) $ticket->raised_by];

        if ($ticket->assigned_to !== null) {
            $ids[] = (int) $ticket->assigned_to;
        }

        if ($ids === [(int) $ticket->raised_by] && $ticket->assigned_department_id !== null) {
            $ids = array_merge($ids, Recipients::activeUsers(
                (int) $ticket->company_id,
                ['department_id' => (int) $ticket->assigned_department_id]
            ));
        }

        if ($ticket->isPlatform() && $ticket->assigned_to === null) {
            $ids = array_merge($ids, $this->superAdmins());
        }

        return Recipients::except($ids, [(int) $actor->id]);
    }

    private function canHandle(Ticket $ticket, User $actor): bool
    {
        if ($actor->isSuperAdmin() && $ticket->isPlatform()) {
            return true;
        }

        if ($ticket->isAssignee($actor) || $actor->hasPermission(Ticket::RESOLVE_PERMISSION)) {
            return true;
        }

        return $ticket->assigned_department_id !== null
            && (int) $ticket->assigned_department_id === (int) $actor->department_id;
    }

    private function assertHandler(Ticket $ticket, User $actor): void
    {
        if (! $this->canHandle($ticket, $actor)) {
            throw new ApiException('Ye ticket aapke paas nahi hai.', 403, 'TICKET_NOT_HANDLER');
        }
    }

    private function assertPermission(User $actor, string $slug, string $action): void
    {
        if (! $actor->hasPermission($slug)) {
            throw new ApiException('Aapke paas ' . $action . ' ka access nahi hai.', 403, 'FORBIDDEN');
        }
    }

    private function category(User $actor, int $categoryId): TicketCategory
    {
        $category = TicketCategory::query()->whereKey($categoryId)->first();

        if ($category === null) {
            throw new ApiException('Category mili nahi.', 404, 'NOT_FOUND');
        }

        return $category;
    }

    private function route(TicketCategory $category, ?int $routeId): TicketCategoryRoute
    {
        $routes = $category->routes()->get();

        if ($routes->isEmpty()) {
            throw new ApiException('Is category ka koi rasta set nahi hai — HR se kehkar set karwao.', 409, 'TICKET_ROUTE_MISSING');
        }

        if ($routeId === null) {
            $route = $routes->firstWhere('is_default', true);

            if ($route === null) {
                throw new ApiException('Batao ye request kisko bhejni hai.', 422, 'TICKET_ROUTE_REQUIRED');
            }

            return $route;
        }

        $route = $routes->firstWhere('id', $routeId);

        if ($route === null) {
            throw new ApiException('Ye rasta is category ka nahi hai.', 422, 'TICKET_ROUTE_MISMATCH');
        }

        return $route;
    }

    private function sla(int $companyId, string $priority, ?TicketCategory $category = null): array
    {
        if ($category?->response_hours !== null || $category?->resolution_hours !== null) {
            return [
                'response_hours' => $category->response_hours === null ? null : (int) $category->response_hours,
                'resolution_hours' => $category->resolution_hours === null ? null : (int) $category->resolution_hours,
            ];
        }

        $enabled = (bool) DB::table('companies')->where('id', $companyId)->value('ticket_sla_enabled');

        if (! $enabled) {
            return ['response_hours' => null, 'resolution_hours' => null];
        }

        $row = DB::table('ticket_slas')
            ->where('company_id', $companyId)
            ->where('priority', $priority)
            ->first(['response_hours', 'resolution_hours']);

        return [
            'response_hours' => (int) ($row->response_hours ?? 8),
            'resolution_hours' => (int) ($row->resolution_hours ?? 48),
        ];
    }

    private function nextNumber(int $companyId, Carbon $now): string
    {
        $prefix = Ticket::NUMBER_PREFIX . '-' . $now->year . '-';

        $last = DB::table('tickets')
            ->where('company_id', $companyId)
            ->where('ticket_no', 'like', $prefix . '%')
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('ticket_no');

        $next = $last === null ? 1 : ((int) substr($last, strlen($prefix))) + 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function notify(Ticket $ticket, array $recipients, User $actor, string $type, string $title, string $body): void
    {
        $recipients = Recipients::except($recipients, [(int) $actor->id]);

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => '/tickets/' . $ticket->uuid,
            'meta' => [
                'ticket_id' => (int) $ticket->id,
                'ticket_no' => $ticket->ticket_no,
                'status' => $ticket->status,
            ],
        ], $actor);
    }

    private function fresh(Ticket $ticket): Ticket
    {
        $this->flush();

        return $ticket->refresh()->load(self::RELATIONS);
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::TICKETS);
    }
}

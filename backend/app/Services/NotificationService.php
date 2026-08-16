<?php

declare(strict_types=1);

namespace App\Services;

use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Realtime;
use App\Support\Recipients;
use App\Support\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class NotificationService
{
    private const DEFAULTS = ['in_app' => true, 'push' => true, 'email' => false];

    private array $preferenceCache = [];

    public function __construct(private readonly PushService $push) {}

    public function send(User|int $user, array $data, ?User $actor = null): ?Notification
    {
        $target = $this->resolve($user);

        if ($target === null) {
            return null;
        }

        $type = (string) $data['type'];
        $group = NotificationType::group($type);
        $preference = $this->preferenceFor($target, $type, $group);

        if (! $preference['in_app'] && ! $preference['push']) {
            return null;
        }

        $notification = $preference['in_app'] ? $this->persist($target, $actor, $type, $group, $data) : null;

        Realtime::toUser((int) $target->id, 'notification.new', [
            'notification' => $notification === null
                ? $this->transient($type, $group, $data)
                : (new NotificationResource($notification))->resolve(),
            'unread_count' => $this->unreadCount($target),
        ]);

        if ($preference['push']) {
            $this->push->toUsers([(int) $target->id], $data);
        }

        return $notification;
    }

    public function sendMany(array $userIds, array $data, ?User $actor = null): int
    {
        $sent = 0;

        foreach (Recipients::except($userIds, []) as $userId) {
            if ($this->send($userId, $data, $actor) !== null) {
                $sent++;
            }
        }

        return $sent;
    }

    public function announce(User $actor, array $data): array
    {
        $companyId = (int) ($actor->company_id ?? 0);

        if ($companyId === 0) {
            return ['recipients' => 0];
        }

        $targets = Recipients::except(
            Recipients::activeUsers($companyId, array_filter([
                'branch_id' => $data['branch_id'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'team_id' => $data['team_id'] ?? null,
            ], fn ($value): bool => $value !== null)),
            [(int) $actor->id]
        );

        if ($targets === []) {
            return ['recipients' => 0];
        }

        $now = Carbon::now();
        $type = NotificationType::ANNOUNCEMENT;
        $payload = json_encode($data['payload'] ?? []);

        $rows = array_map(fn (int $userId): array => [
            'uuid' => (string) Str::uuid(),
            'company_id' => $companyId,
            'user_id' => $userId,
            'actor_id' => $actor->id,
            'type' => $type,
            'group_name' => NotificationType::group($type),
            'priority' => $data['priority'] ?? NotificationType::NORMAL,
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'action_url' => $data['action_url'] ?? null,
            'entity_type' => null,
            'entity_id' => null,
            'payload' => $payload,
            'dedupe_key' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ], $targets);

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('notifications')->insert($chunk);
        }

        Realtime::toCompany($companyId, 'announcement.new', [
            'type' => $type,
            'priority' => $data['priority'] ?? NotificationType::NORMAL,
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'action_url' => $data['action_url'] ?? null,
            'actor_id' => (int) $actor->id,
            'actor_name' => $actor->name,
            'created_at' => $now->toIso8601String(),
        ]);

        $this->push->toUsers($targets, [
            'title' => $data['title'],
            'body' => $data['body'] ?? '',
            'type' => $type,
            'action_url' => $data['action_url'] ?? '',
        ]);

        return ['recipients' => count($targets)];
    }

    public function markRead(Notification $notification, User $actor): Notification
    {
        if ($notification->markRead()) {
            Realtime::toUser((int) $actor->id, 'notification.read', [
                'notification_id' => (int) $notification->id,
                'unread_count' => $this->unreadCount($actor),
            ]);
        }

        return $notification->refresh();
    }

    public function markAllRead(User $actor, ?string $group = null): int
    {
        $count = $this->query()
            ->where('user_id', $actor->id)
            ->whereNull('read_at')
            ->when($group !== null, fn (Builder $query) => $query->where('group_name', $group))
            ->update(['read_at' => Carbon::now(), 'updated_at' => Carbon::now()]);

        if ($count > 0) {
            Realtime::toUser((int) $actor->id, 'notification.read_all', [
                'group' => $group,
                'marked' => $count,
                'unread_count' => $this->unreadCount($actor),
            ]);
        }

        return $count;
    }

    public function delete(Notification $notification, User $actor): void
    {
        $id = (int) $notification->id;
        $notification->delete();

        Realtime::toUser((int) $actor->id, 'notification.deleted', [
            'notification_id' => $id,
            'unread_count' => $this->unreadCount($actor),
        ]);
    }

    public function clear(User $actor, bool $onlyRead): int
    {
        $count = $this->query()
            ->where('user_id', $actor->id)
            ->when($onlyRead, fn (Builder $query) => $query->whereNotNull('read_at'))
            ->delete();

        if ($count > 0) {
            Realtime::toUser((int) $actor->id, 'notification.cleared', [
                'only_read' => $onlyRead,
                'deleted' => $count,
                'unread_count' => $this->unreadCount($actor),
            ]);
        }

        return $count;
    }

    public function summary(User $actor): array
    {
        $groups = $this->query()
            ->where('user_id', $actor->id)
            ->whereNull('read_at')
            ->selectRaw('group_name, COUNT(*) as total')
            ->groupBy('group_name')
            ->pluck('total', 'group_name')
            ->map(fn ($count): int => (int) $count)
            ->all();

        return [
            'unread_count' => array_sum($groups),
            'by_group' => $groups,
        ];
    }

    public function unreadCount(User $actor): int
    {
        return $this->query()->where('user_id', $actor->id)->whereNull('read_at')->count();
    }

    public function preferences(User $actor): Collection
    {
        $stored = $this->storedPreferences($actor);

        return collect(NotificationType::GROUPS)->map(fn (string $group): array => [
            'scope' => $group,
            'in_app' => (bool) ($stored[$group]['in_app'] ?? self::DEFAULTS['in_app']),
            'push' => (bool) ($stored[$group]['push'] ?? self::DEFAULTS['push']),
            'email' => (bool) ($stored[$group]['email'] ?? self::DEFAULTS['email']),
            'is_default' => ! isset($stored[$group]),
        ])->values();
    }

    public function savePreferences(User $actor, array $items): Collection
    {
        foreach ($items as $item) {
            $preference = NotificationPreference::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('user_id', $actor->id)
                ->where('scope', $item['scope'])
                ->first() ?? new NotificationPreference();

            $preference->fill([
                'scope' => $item['scope'],
                'in_app' => (bool) ($item['in_app'] ?? self::DEFAULTS['in_app']),
                'push' => (bool) ($item['push'] ?? self::DEFAULTS['push']),
                'email' => (bool) ($item['email'] ?? self::DEFAULTS['email']),
            ]);

            $preference->company_id = $actor->company_id;
            $preference->user_id = $actor->id;
            $preference->updated_by = $actor->id;

            if ($preference->created_by === null) {
                $preference->created_by = $actor->id;
            }

            $preference->save();
        }

        unset($this->preferenceCache[(int) $actor->id]);

        return $this->preferences($actor);
    }

    private function persist(User $target, ?User $actor, string $type, string $group, array $data): Notification
    {
        $dedupeKey = $data['dedupe_key'] ?? null;

        $notification = $dedupeKey === null
            ? new Notification()
            : ($this->query()
                ->where('user_id', $target->id)
                ->whereNull('read_at')
                ->where('dedupe_key', $dedupeKey)
                ->first() ?? new Notification());

        $notification->fill([
            'type' => $type,
            'group_name' => $group,
            'priority' => $data['priority'] ?? NotificationType::priority($type),
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'action_url' => $data['action_url'] ?? null,
            'entity_type' => $data['entity_type'] ?? null,
            'entity_id' => $data['entity_id'] ?? null,
            'payload' => $data['payload'] ?? [],
            'dedupe_key' => $dedupeKey,
        ]);

        $notification->company_id = $target->company_id;
        $notification->user_id = $target->id;
        $notification->actor_id = $actor?->id;
        $notification->save();

        return $notification->refresh();
    }

    private function transient(string $type, string $group, array $data): array
    {
        return [
            'id' => null,
            'uuid' => null,
            'type' => $type,
            'group' => $group,
            'priority' => $data['priority'] ?? NotificationType::priority($type),
            'title' => $data['title'],
            'body' => $data['body'] ?? null,
            'action_url' => $data['action_url'] ?? null,
            'entity_type' => $data['entity_type'] ?? null,
            'entity_id' => isset($data['entity_id']) ? (int) $data['entity_id'] : null,
            'payload' => $data['payload'] ?? [],
            'is_read' => false,
            'read_at' => null,
            'created_at' => Carbon::now()->toIso8601String(),
        ];
    }

    private function preferenceFor(User $target, string $type, string $group): array
    {
        $stored = $this->storedPreferences($target);

        return array_merge(self::DEFAULTS, $stored[$group] ?? [], $stored[$type] ?? []);
    }

    private function storedPreferences(User $target): array
    {
        $userId = (int) $target->id;

        return $this->preferenceCache[$userId] ??= NotificationPreference::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('user_id', $userId)
            ->get(['scope', 'in_app', 'push', 'email'])
            ->keyBy('scope')
            ->map(fn (NotificationPreference $preference): array => [
                'in_app' => $preference->in_app,
                'push' => $preference->push,
                'email' => $preference->email,
            ])
            ->all();
    }

    private function resolve(User|int $user): ?User
    {
        if ($user instanceof User) {
            return $user;
        }

        return User::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->whereKey($user)
            ->where('status', 'active')
            ->first();
    }

    private function query(): Builder
    {
        return Notification::query()->withoutGlobalScope(CompanyScope::class);
    }
}

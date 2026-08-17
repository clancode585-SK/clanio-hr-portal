<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\TicketCategoryRoute;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class TicketCategoryService
{
    public function listFor(User $actor, ?string $scope = null): Collection
    {
        $scope ??= $actor->hasPermission(Ticket::PLATFORM_PERMISSION)
            ? null
            : TicketCategory::SCOPE_INTERNAL;

        return TicketCategory::query()
            ->with(['routes.department', 'routes.user'])
            ->when($scope !== null, fn ($query) => $query->where('scope', $scope))
            ->orderBy('scope')
            ->orderBy('sort_order')
            ->get();
    }

    public function create(array $data, User $actor, ?int $companyId): TicketCategory
    {
        return DB::transaction(function () use ($data, $actor, $companyId): TicketCategory {
            $category = new TicketCategory($this->attributes($data));
            $category->company_id = $companyId ?? $actor->company_id;
            $category->created_by = $actor->id;
            $category->save();

            $this->syncRoutes($category, $data['routes'] ?? [], $actor);
            $this->flush();

            return $category->refresh()->load(['routes.department', 'routes.user']);
        });
    }

    public function update(TicketCategory $category, array $data, User $actor): TicketCategory
    {
        return DB::transaction(function () use ($category, $data, $actor): TicketCategory {
            $category->fill($this->attributes($data));
            $category->updated_by = $actor->id;
            $category->save();

            if (array_key_exists('routes', $data)) {
                $this->syncRoutes($category, $data['routes'], $actor);
            }

            $this->flush();

            return $category->refresh()->load(['routes.department', 'routes.user']);
        });
    }

    public function delete(TicketCategory $category, User $actor): void
    {
        if ($category->is_system) {
            throw new ApiException('Ye default category hai — hata nahi sakte, band kar sakte ho.', 409, 'TICKET_CATEGORY_SYSTEM');
        }

        $open = $category->tickets()
            ->whereIn('status', [Ticket::OPEN, Ticket::IN_PROGRESS, Ticket::WAITING_ON_USER])
            ->count();

        if ($open > 0) {
            throw new ApiException('Is category ke ' . $open . ' ticket abhi khule hain — pehle unhe band karo.', 409, 'TICKET_CATEGORY_IN_USE');
        }

        DB::transaction(function () use ($category, $actor): void {
            $category->routes()->update(['is_active' => 0, 'updated_by' => $actor->id]);
            $category->forceFill(['is_active' => 0, 'updated_by' => $actor->id])->save();

            $this->flush();
        });
    }

    private function syncRoutes(TicketCategory $category, array $routes, User $actor): void
    {
        if ($routes === []) {
            return;
        }

        $category->routes()->update(['is_active' => 0, 'updated_by' => $actor->id]);

        $defaults = 0;

        foreach (array_values($routes) as $index => $row) {
            $isDefault = (bool) ($row['is_default'] ?? false);

            if ($isDefault) {
                $defaults++;
            }

            if ($defaults > 1) {
                throw new ApiException('Ek category me sirf ek default rasta ho sakta hai.', 422, 'TICKET_ROUTE_DEFAULT_DUPLICATE');
            }

            $this->assertTarget($row);

            $route = new TicketCategoryRoute([
                'route_to' => $row['route_to'],
                'department_id' => $row['department_id'] ?? null,
                'user_id' => $row['user_id'] ?? null,
                'label' => $row['label'],
                'hint' => $row['hint'] ?? null,
                'is_default' => $isDefault,
                'sort_order' => (int) ($row['sort_order'] ?? $index + 1),
            ]);

            $route->company_id = $category->company_id;
            $route->category_id = $category->id;
            $route->created_by = $actor->id;
            $route->save();
        }
    }

    private function assertTarget(array $row): void
    {
        $target = $row['route_to'] ?? null;

        if ($target === TicketCategoryRoute::TO_DEPARTMENT && empty($row['department_id'])) {
            throw new ApiException('Department wale raste me department chunna zaroori hai.', 422, 'TICKET_ROUTE_DEPARTMENT_REQUIRED');
        }

        if ($target === TicketCategoryRoute::TO_USER && empty($row['user_id'])) {
            throw new ApiException('User wale raste me user chunna zaroori hai.', 422, 'TICKET_ROUTE_USER_REQUIRED');
        }
    }

    private function attributes(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'name', 'code', 'scope', 'default_priority', 'support_email',
            'response_hours', 'resolution_hours', 'sort_order', 'is_active',
        ]));
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::TICKETS);
    }
}

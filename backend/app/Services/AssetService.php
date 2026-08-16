<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Asset;
use App\Models\AssetAllocation;
use App\Models\Employee;
use App\Models\ExitClearance;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AssetService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function create(array $data, User $actor, ?int $companyId): Asset
    {
        $this->assertPermission($actor, Asset::MANAGE_PERMISSION, 'asset banane');

        if ($companyId === null) {
            throw new ApiException(
                'Asset company ka hota hai. X-Company-Id header bhejo.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return DB::transaction(function () use ($data, $actor, $companyId): Asset {
            $asset = new Asset($data);
            $asset->company_id = $companyId;
            $asset->asset_code = $data['asset_code'] ?? $this->nextCode($companyId);
            $asset->created_by = $actor->id;
            $asset->save();

            $this->flush();

            return $asset->refresh();
        });
    }

    public function update(Asset $asset, array $data, User $actor): Asset
    {
        $this->assertPermission($actor, Asset::MANAGE_PERMISSION, 'asset badalne');

        $asset->fill($data);
        $asset->updated_by = $actor->id;
        $asset->save();

        $this->flush();

        return $asset->refresh()->load('currentAllocation.employee.user');
    }

    public function retire(Asset $asset, array $data, User $actor): Asset
    {
        $this->assertPermission($actor, Asset::MANAGE_PERMISSION, 'asset retire karne');

        if ($asset->isAllocated()) {
            throw new ApiException(
                'Ye asset abhi allocated hai — pehle wapas lo.',
                409,
                'ASSET_ALLOCATED'
            );
        }

        $asset->forceFill([
            'status' => $data['status'] ?? Asset::RETIRED,
            'notes' => $data['notes'] ?? $asset->notes,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $asset->refresh();
    }

    public function delete(Asset $asset, User $actor): void
    {
        $this->assertPermission($actor, Asset::MANAGE_PERMISSION, 'asset hataane');

        if ($asset->isAllocated()) {
            throw new ApiException('Allocated asset delete nahi hota — pehle wapas lo.', 409, 'ASSET_ALLOCATED');
        }

        $asset->deactivate();
        $this->flush();
    }

    public function allocate(Asset $asset, array $data, User $actor): AssetAllocation
    {
        $this->assertPermission($actor, Asset::MANAGE_PERMISSION, 'asset allocate karne');

        if ($asset->isRetired()) {
            throw new ApiException('Retired ya lost asset allocate nahi hota.', 409, 'ASSET_NOT_AVAILABLE');
        }

        if (! $asset->isAvailable()) {
            throw new ApiException(
                'Ye asset abhi ' . $asset->status . ' hai, allocate nahi ho sakta.',
                409,
                'ASSET_NOT_AVAILABLE'
            );
        }

        $employee = $this->employee((int) $data['employee_id'], $actor);

        if ($employee->isExited()) {
            throw new ApiException('Exit ho chuke employee ko asset nahi de sakte.', 409, 'EMPLOYEE_EXITED');
        }

        $allocation = DB::transaction(function () use ($asset, $employee, $data, $actor): AssetAllocation {
            $allocation = new AssetAllocation([
                'allocated_on' => $data['allocated_on'] ?? Carbon::today()->toDateString(),
                'expected_return_date' => $data['expected_return_date'] ?? null,
                'allocation_condition' => $data['condition'] ?? $asset->condition_state,
                'allocation_remarks' => $data['remarks'] ?? null,
            ]);

            $allocation->company_id = $asset->company_id;
            $allocation->asset_id = $asset->id;
            $allocation->employee_id = $employee->id;
            $allocation->allocated_by = $actor->id;
            $allocation->created_by = $actor->id;
            $allocation->save();

            $asset->forceFill(['status' => Asset::ALLOCATED, 'updated_by' => $actor->id])->save();

            $this->flush();

            return $allocation->refresh()->load('asset', 'employee.user', 'allocator');
        });

        $this->notifyEmployee(
            $allocation,
            $actor,
            NotificationType::ASSET_ALLOCATED,
            'Aapko asset mila hai',
            $asset->label() . ' — sambhal ke rakhna, exit par wapas karna hoga.'
        );

        return $allocation;
    }

    public function returnAsset(Asset $asset, array $data, User $actor): AssetAllocation
    {
        $this->assertPermission($actor, Asset::MANAGE_PERMISSION, 'asset wapas lene');

        $allocation = AssetAllocation::query()
            ->where('asset_id', $asset->id)
            ->where('status', AssetAllocation::ALLOCATED)
            ->first();

        if ($allocation === null) {
            throw new ApiException('Ye asset kisi ko allocated hi nahi hai.', 409, 'ASSET_NOT_ALLOCATED');
        }

        $condition = $data['condition'] ?? Asset::GOOD;
        $amount = round((float) ($data['recoverable_amount'] ?? 0), 2);

        if ($amount > 0 && ($data['remarks'] ?? null) === null) {
            throw new ApiException(
                'Recovery amount laga rahe ho to wajah likhni zaroori hai.',
                422,
                'ASSET_REMARKS_REQUIRED'
            );
        }

        return DB::transaction(function () use ($asset, $allocation, $data, $condition, $amount, $actor): AssetAllocation {
            $allocation->forceFill([
                'status' => AssetAllocation::RETURNED,
                'returned_on' => $data['returned_on'] ?? Carbon::today()->toDateString(),
                'received_by' => $actor->id,
                'return_condition' => $condition,
                'return_remarks' => $data['remarks'] ?? null,
                'recoverable_amount' => $amount,
                'updated_by' => $actor->id,
            ])->save();

            $asset->forceFill([
                'status' => $condition === Asset::DAMAGED ? Asset::IN_REPAIR : Asset::AVAILABLE,
                'condition_state' => $condition,
                'updated_by' => $actor->id,
            ])->save();

            $this->clearExitClearance($allocation, $amount, $data['remarks'] ?? null, $actor);
            $this->flush();

            return $allocation->refresh()->load('asset', 'employee.user', 'receiver');
        });
    }

    public function historyFor(Asset $asset): array
    {
        return AssetAllocation::query()
            ->with('employee.user', 'allocator', 'receiver')
            ->where('asset_id', $asset->id)
            ->orderByDesc('id')
            ->get()
            ->all();
    }

    public function allocatedTo(User $actor, ?int $employeeId): array
    {
        $employee = $employeeId === null
            ? Employee::query()->where('user_id', $actor->id)->first()
            : Employee::query()->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee record nahi mila.', 404, 'NOT_FOUND');
        }

        return AssetAllocation::query()
            ->with('asset', 'allocator')
            ->where('employee_id', $employee->id)
            ->where('status', AssetAllocation::ALLOCATED)
            ->orderBy('id')
            ->get()
            ->all();
    }

    public function summary(User $actor): array
    {
        $this->assertPermission($actor, Asset::MANAGE_PERMISSION, 'asset summary dekhne');

        $counts = DB::table('assets')
            ->where('company_id', $actor->company_id)
            ->where('is_active', 1)
            ->selectRaw("
                COUNT(*) as total,
                SUM(status = 'available') as available,
                SUM(status = 'allocated') as allocated,
                SUM(status = 'in_repair') as in_repair,
                SUM(status = 'lost') as lost,
                SUM(status = 'retired') as retired,
                COALESCE(SUM(purchase_cost), 0) as total_cost
            ")
            ->first();

        $byCategory = DB::table('assets')
            ->where('company_id', $actor->company_id)
            ->where('is_active', 1)
            ->groupBy('category')
            ->get(['category', DB::raw('COUNT(*) as total'), DB::raw("SUM(status = 'allocated') as allocated")])
            ->map(fn ($row): array => [
                'category' => $row->category,
                'label' => Asset::CATEGORIES[$row->category] ?? $row->category,
                'total' => (int) $row->total,
                'allocated' => (int) $row->allocated,
            ])
            ->all();

        $openRequests = (int) DB::table('asset_requests')
            ->where('company_id', $actor->company_id)
            ->where('is_open', 1)
            ->count();

        return [
            'counts' => [
                'total' => (int) $counts->total,
                'available' => (int) $counts->available,
                'allocated' => (int) $counts->allocated,
                'in_repair' => (int) $counts->in_repair,
                'lost' => (int) $counts->lost,
                'retired' => (int) $counts->retired,
            ],
            'total_cost' => round((float) $counts->total_cost, 2),
            'open_requests' => $openRequests,
            'by_category' => $byCategory,
        ];
    }

    public function openAllocationsFor(Employee $employee): array
    {
        return AssetAllocation::query()
            ->with('asset')
            ->where('employee_id', $employee->id)
            ->where('status', AssetAllocation::ALLOCATED)
            ->get()
            ->all();
    }

    private function clearExitClearance(AssetAllocation $allocation, float $amount, ?string $remarks, User $actor): void
    {
        $clearance = ExitClearance::query()
            ->where('asset_allocation_id', $allocation->id)
            ->where('status', ExitClearance::PENDING)
            ->first();

        if ($clearance === null) {
            return;
        }

        $clearance->forceFill([
            'status' => ExitClearance::CLEARED,
            'remarks' => $remarks ?? 'Asset wapas mil gaya',
            'recoverable_amount' => $amount,
            'cleared_by' => $actor->id,
            'cleared_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        TenantCache::flush(TenantCache::EXITS);
    }

    private function nextCode(int $companyId): string
    {
        $last = DB::table('assets')
            ->where('company_id', $companyId)
            ->where('asset_code', 'like', Asset::CODE_PREFIX . '%')
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('asset_code');

        $next = $last === null ? 1 : ((int) substr($last, strlen(Asset::CODE_PREFIX))) + 1;

        return Asset::CODE_PREFIX . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function employee(int $employeeId, User $actor): Employee
    {
        $employee = Employee::query()->with('user')->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }

    private function assertPermission(User $actor, string $permission, string $what): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission($permission)) {
            return;
        }

        throw new ApiException('Aapke paas ' . $what . ' ka haq nahi hai.', 403, 'FORBIDDEN');
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::ASSETS);
    }

    private function notifyEmployee(AssetAllocation $allocation, User $actor, string $type, string $title, string $body): void
    {
        $userId = (int) ($allocation->employee->user_id ?? 0);

        if ($userId === 0 || $userId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($userId, [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => '/my-assets',
            'entity_type' => 'asset_allocation',
            'entity_id' => $allocation->id,
            'payload' => [
                'asset_id' => $allocation->asset_id,
                'asset_code' => $allocation->asset?->asset_code,
            ],
            'dedupe_key' => 'asset:' . $allocation->id . ':' . $type,
        ]);
    }
}

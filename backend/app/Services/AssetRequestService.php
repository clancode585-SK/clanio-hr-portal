<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Asset;
use App\Models\AssetAllocation;
use App\Models\AssetRequest;
use App\Models\Employee;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Recipients;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AssetRequestService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function raise(User $actor, array $data): AssetRequest
    {
        $employee = $this->employeeFor($actor, isset($data['employee_id']) ? (int) $data['employee_id'] : null);
        $type = (string) $data['request_type'];
        $asset = $this->assetFor($type, $data, $employee);

        $request = DB::transaction(function () use ($employee, $asset, $type, $data, $actor): AssetRequest {
            $request = new AssetRequest([
                'request_type' => $type,
                'category' => $type === AssetRequest::TYPE_NEW ? ($data['category'] ?? null) : $asset?->category,
                'title' => $data['title'],
                'description' => $data['description'],
                'priority' => $data['priority'] ?? 'normal',
            ]);

            $request->company_id = $employee->company_id;
            $request->employee_id = $employee->id;
            $request->asset_id = $asset?->id;
            $request->applied_by = $actor->id;
            $request->created_by = $actor->id;
            $request->save();

            $this->flush();

            return $request->refresh()->load('employee.user', 'asset');
        });

        $this->notifyHandlers($request, $actor);

        return $request;
    }

    public function update(AssetRequest $request, array $data, User $actor): AssetRequest
    {
        $this->assertOwner($request, $actor);

        if (! $request->isPending()) {
            throw new ApiException(
                'IT ke haath me jaane ke baad request edit nahi hoti — abhi ' . $request->stageLabel() . '.',
                409,
                'ASSET_REQUEST_NOT_EDITABLE'
            );
        }

        $request->fill($data);
        $request->updated_by = $actor->id;
        $request->save();

        $this->flush();

        return $request->refresh()->load('employee.user', 'asset');
    }

    public function approve(AssetRequest $request, array $data, User $actor): AssetRequest
    {
        $this->assertPermission($actor, Asset::SUPPORT_PERMISSION, 'request approve karne');

        if (! $request->isPending()) {
            throw new ApiException(
                'Ye request ab pending nahi hai — abhi ' . $request->stageLabel() . '.',
                409,
                'ASSET_REQUEST_WRONG_STAGE'
            );
        }

        $request->forceFill([
            'status' => AssetRequest::APPROVED,
            'handler_id' => $actor->id,
            'decided_at' => Carbon::now(),
            'decision_remarks' => $data['remarks'] ?? null,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();
        $request = $request->refresh()->load('employee.user', 'asset', 'handler');

        $this->notifyEmployee($request, $actor, NotificationType::ASSET_REQUEST_APPROVED,
            'Asset request approve ho gayi',
            $request->title . ' — IT kaam shuru karega.');

        return $request;
    }

    public function reject(AssetRequest $request, array $data, User $actor): AssetRequest
    {
        $this->assertPermission($actor, Asset::SUPPORT_PERMISSION, 'request reject karne');

        if ($request->isClosed()) {
            throw new ApiException('Ye request already band hai.', 409, 'ASSET_REQUEST_CLOSED');
        }

        $request->forceFill([
            'status' => AssetRequest::REJECTED,
            'handler_id' => $actor->id,
            'decided_at' => Carbon::now(),
            'decision_remarks' => $data['reason'],
            'updated_by' => $actor->id,
        ])->save();

        $this->releaseAsset($request, $actor);
        $this->flush();
        $request = $request->refresh()->load('employee.user', 'asset', 'handler');

        $this->notifyEmployee($request, $actor, NotificationType::ASSET_REQUEST_REJECTED,
            'Asset request reject ho gayi',
            $data['reason']);

        return $request;
    }

    public function start(AssetRequest $request, User $actor): AssetRequest
    {
        $this->assertPermission($actor, Asset::SUPPORT_PERMISSION, 'kaam shuru karne');

        if (! $request->isApproved()) {
            throw new ApiException(
                'Pehle approve karo, phir kaam shuru hoga — abhi ' . $request->stageLabel() . '.',
                409,
                'ASSET_REQUEST_WRONG_STAGE'
            );
        }

        DB::transaction(function () use ($request, $actor): void {
            $request->forceFill([
                'status' => AssetRequest::IN_PROGRESS,
                'started_at' => Carbon::now(),
                'handler_id' => $actor->id,
                'updated_by' => $actor->id,
            ])->save();

            $asset = $request->asset;

            if ($asset !== null && $request->request_type === AssetRequest::TYPE_REPAIR) {
                $asset->forceFill(['status' => Asset::IN_REPAIR, 'updated_by' => $actor->id])->save();
            }

            $this->flush();
        });

        return $request->refresh()->load('employee.user', 'asset', 'handler');
    }

    public function resolve(AssetRequest $request, array $data, User $actor): AssetRequest
    {
        $this->assertPermission($actor, Asset::SUPPORT_PERMISSION, 'request close karne');

        if (! $request->isInProgress() && ! $request->isApproved()) {
            throw new ApiException(
                'Sirf approve ya chal rahi request hi resolve hoti hai — abhi ' . $request->stageLabel() . '.',
                409,
                'ASSET_REQUEST_WRONG_STAGE'
            );
        }

        DB::transaction(function () use ($request, $data, $actor): void {
            $request->forceFill([
                'status' => AssetRequest::RESOLVED,
                'resolution' => $data['resolution'],
                'resolved_at' => Carbon::now(),
                'handler_id' => $actor->id,
                'updated_by' => $actor->id,
            ])->save();

            $asset = $request->asset;

            if ($asset !== null && $asset->status === Asset::IN_REPAIR) {
                $stillAllocated = AssetAllocation::query()
                    ->where('asset_id', $asset->id)
                    ->where('status', AssetAllocation::ALLOCATED)
                    ->exists();

                $asset->forceFill([
                    'status' => $stillAllocated ? Asset::ALLOCATED : Asset::AVAILABLE,
                    'condition_state' => $data['condition'] ?? $asset->condition_state,
                    'updated_by' => $actor->id,
                ])->save();
            }

            $this->flush();
        });

        $request = $request->refresh()->load('employee.user', 'asset', 'handler');

        $this->notifyEmployee($request, $actor, NotificationType::ASSET_REQUEST_RESOLVED,
            'Asset request complete ho gayi',
            $data['resolution']);

        return $request;
    }

    public function cancel(AssetRequest $request, User $actor): AssetRequest
    {
        $this->assertOwner($request, $actor);

        if (! $request->isPending()) {
            throw new ApiException(
                'IT ke haath me jaane ke baad cancel nahi hoti — abhi ' . $request->stageLabel() . '.',
                409,
                'ASSET_REQUEST_NOT_CANCELLABLE'
            );
        }

        $request->forceFill([
            'status' => AssetRequest::CANCELLED,
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $request->refresh()->load('employee.user', 'asset');
    }

    private function releaseAsset(AssetRequest $request, User $actor): void
    {
        $asset = $request->asset;

        if ($asset === null || $asset->status !== Asset::IN_REPAIR) {
            return;
        }

        $stillAllocated = AssetAllocation::query()
            ->where('asset_id', $asset->id)
            ->where('status', AssetAllocation::ALLOCATED)
            ->exists();

        $asset->forceFill([
            'status' => $stillAllocated ? Asset::ALLOCATED : Asset::AVAILABLE,
            'updated_by' => $actor->id,
        ])->save();
    }

    private function assetFor(string $type, array $data, Employee $employee): ?Asset
    {
        if ($type === AssetRequest::TYPE_NEW) {
            if (($data['category'] ?? null) === null) {
                throw new ApiException(
                    'Naya asset maang rahe ho to category chunni zaroori hai.',
                    422,
                    'ASSET_CATEGORY_REQUIRED'
                );
            }

            return null;
        }

        if (($data['asset_id'] ?? null) === null) {
            throw new ApiException(
                'Kis asset ka issue hai wo chunna zaroori hai.',
                422,
                'ASSET_REQUIRED'
            );
        }

        $asset = Asset::query()->whereKey((int) $data['asset_id'])->first();

        if ($asset === null) {
            throw new ApiException('Asset not found.', 404, 'NOT_FOUND');
        }

        $isMine = AssetAllocation::query()
            ->where('asset_id', $asset->id)
            ->where('employee_id', $employee->id)
            ->where('status', AssetAllocation::ALLOCATED)
            ->exists();

        if (! $isMine) {
            throw new ApiException(
                'Ye asset aapko allocated nahi hai.',
                403,
                'ASSET_NOT_YOURS'
            );
        }

        $open = AssetRequest::query()
            ->where('asset_id', $asset->id)
            ->where('employee_id', $employee->id)
            ->where('request_type', $type)
            ->where('is_open', 1)
            ->exists();

        if ($open) {
            throw new ApiException(
                'Is asset par aapki ek request already chal rahi hai.',
                409,
                'ASSET_REQUEST_ALREADY_OPEN'
            );
        }

        return $asset;
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        if ($employeeId === null) {
            $employee = Employee::query()->with('user')->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Request ke liye employee record chahiye. HR se baat karo.',
                    422,
                    'EMPLOYEE_RECORD_MISSING'
                );
            }

            return $employee;
        }

        if (! $actor->isSuperAdmin() && ! $actor->hasPermission(Asset::SUPPORT_PERMISSION)) {
            throw new ApiException('Kisi aur ki request daalne ki permission nahi hai.', 403, 'FORBIDDEN');
        }

        $employee = Employee::query()->with('user')->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }

    private function assertOwner(AssetRequest $request, User $actor): void
    {
        if ((int) $request->employee->user_id === (int) $actor->id || $actor->isSuperAdmin()) {
            return;
        }

        throw new ApiException('Ye request aapki nahi hai.', 403, 'FORBIDDEN');
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

    private function notifyHandlers(AssetRequest $request, User $actor): void
    {
        $recipients = Recipients::except(
            Recipients::withPermission((int) $request->company_id, Asset::SUPPORT_PERMISSION),
            [(int) $request->employee->user_id, (int) $actor->id]
        );

        if ($recipients === []) {
            return;
        }

        $name = $request->employee->user?->name ?? $request->employee->employee_code;

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::ASSET_REQUEST_RAISED,
            'title' => $name . ' ne asset request daali hai',
            'body' => $request->typeLabel() . ' · ' . $request->title
                . ($request->asset === null ? '' : ' · ' . $request->asset->label()),
            'action_url' => '/asset-requests/' . $request->uuid,
            'entity_type' => 'asset_request',
            'entity_id' => $request->id,
            'payload' => [
                'request_id' => $request->id,
                'type' => $request->request_type,
                'priority' => $request->priority,
            ],
            'dedupe_key' => 'asset-request:' . $request->id . ':raised',
        ], $actor);
    }

    private function notifyEmployee(AssetRequest $request, User $actor, string $type, string $title, string $body): void
    {
        $userId = (int) ($request->employee->user_id ?? 0);

        if ($userId === 0 || $userId === (int) $actor->id) {
            return;
        }

        $this->notifications->send($userId, [
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'action_url' => '/asset-requests/' . $request->uuid,
            'entity_type' => 'asset_request',
            'entity_id' => $request->id,
            'payload' => ['request_id' => $request->id, 'status' => $request->status],
            'dedupe_key' => 'asset-request:' . $request->id . ':' . $type,
        ]);
    }
}

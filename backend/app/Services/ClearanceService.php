<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\ClearanceItem;
use App\Models\EmployeeExit;
use App\Models\ExitClearance;
use App\Models\PolicyAcknowledgement;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Recipients;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ClearanceService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly AssetService $assets
    ) {}

    public function createItem(array $data, User $actor, ?int $companyId): ClearanceItem
    {
        $this->assertPermission($actor, ClearanceItem::MANAGE_PERMISSION, 'checklist banane');

        $item = new ClearanceItem($data);
        $item->company_id = $companyId;
        $item->created_by = $actor->id;
        $item->save();

        $this->flush();

        return $item->refresh();
    }

    public function updateItem(ClearanceItem $item, array $data, User $actor): ClearanceItem
    {
        $this->assertPermission($actor, ClearanceItem::MANAGE_PERMISSION, 'checklist badalne');

        $item->fill($data);
        $item->updated_by = $actor->id;
        $item->save();

        $this->flush();

        return $item->refresh();
    }

    public function deleteItem(ClearanceItem $item, User $actor): void
    {
        $this->assertPermission($actor, ClearanceItem::MANAGE_PERMISSION, 'checklist hataane');

        $item->deactivate();
        $this->flush();
    }

    public function generateFor(EmployeeExit $exit, ?User $actor = null): int
    {
        $existing = ExitClearance::query()->where('employee_exit_id', $exit->id)->exists();

        if ($existing) {
            return 0;
        }

        $items = ClearanceItem::query()
            ->where('company_id', $exit->company_id)
            ->orderBy('department')
            ->orderBy('sort_order')
            ->get();

        $allocations = $this->assets->openAllocationsFor($exit->employee);

        if ($items->isEmpty() && $allocations === []) {
            return 0;
        }

        $count = 0;

        foreach ($items as $item) {
            $clearance = new ExitClearance();
            $clearance->company_id = $exit->company_id;
            $clearance->employee_exit_id = $exit->id;
            $clearance->clearance_item_id = $item->id;
            $clearance->department = $item->department;
            $clearance->title = $item->title;
            $clearance->is_recoverable = $item->is_recoverable;
            $clearance->is_mandatory = $item->is_mandatory;
            $clearance->created_by = $actor?->id;
            $clearance->save();

            $count++;
        }

        foreach ($allocations as $allocation) {
            $clearance = new ExitClearance();
            $clearance->company_id = $exit->company_id;
            $clearance->employee_exit_id = $exit->id;
            $clearance->asset_allocation_id = $allocation->id;
            $clearance->source = ExitClearance::SOURCE_ASSET;
            $clearance->department = ClearanceItem::IT;
            $clearance->title = $allocation->asset?->label() . ' wapas';
            $clearance->is_recoverable = true;
            $clearance->is_mandatory = true;
            $clearance->created_by = $actor?->id;
            $clearance->save();

            $count++;
        }

        $count += $this->addPolicyItem($exit, $actor);

        $this->flush();
        $this->notifySignOff($exit, $count, $actor);

        return $count;
    }

    private function addPolicyItem(EmployeeExit $exit, ?User $actor): int
    {
        $pending = PolicyAcknowledgement::query()
            ->where('employee_id', $exit->employee_id)
            ->where('status', PolicyAcknowledgement::PENDING)
            ->count();

        if ($pending === 0) {
            return 0;
        }

        $clearance = new ExitClearance();
        $clearance->company_id = $exit->company_id;
        $clearance->employee_exit_id = $exit->id;
        $clearance->source = ExitClearance::SOURCE_POLICY;
        $clearance->department = ClearanceItem::HR;
        $clearance->title = $pending . ' policy acknowledgement pending';
        $clearance->is_recoverable = false;
        $clearance->is_mandatory = true;
        $clearance->created_by = $actor?->id;
        $clearance->save();

        return 1;
    }

    /**
     * Saari policies accept hote hi exit ka policy wala item apne aap clear ho jata hai.
     */
    public function clearPolicyItems(int $employeeId, User $actor): void
    {
        $rows = ExitClearance::query()
            ->whereHas('exit', fn ($query) => $query->where('employee_id', $employeeId))
            ->where('source', ExitClearance::SOURCE_POLICY)
            ->where('status', ExitClearance::PENDING)
            ->get();

        foreach ($rows as $row) {
            $row->forceFill([
                'status' => ExitClearance::CLEARED,
                'remarks' => 'Saari policies accept ho gayi',
                'cleared_by' => $actor->id,
                'cleared_at' => Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();
        }

        if ($rows->isNotEmpty()) {
            $this->flush();
        }
    }

    public function sign(ExitClearance $clearance, array $data, User $actor): ExitClearance
    {
        $exit = $clearance->exit;

        if ($exit === null) {
            throw new ApiException('Exit record nahi mila.', 404, 'NOT_FOUND');
        }

        if ($exit->isExited()) {
            throw new ApiException('Exit complete ho chuka hai, ab clearance nahi badalti.', 409, 'EXIT_ALREADY_CLOSED');
        }

        $this->assertCanSign($clearance, $exit, $actor);

        $status = $data['status'];
        $amount = round((float) ($data['recoverable_amount'] ?? 0), 2);

        if ($status === ExitClearance::BLOCKED && ($data['remarks'] ?? null) === null) {
            throw new ApiException('Block karne ki wajah likhni zaroori hai.', 422, 'CLEARANCE_REMARKS_REQUIRED');
        }

        if ($amount > 0 && ! $clearance->is_recoverable) {
            throw new ApiException(
                'Is item par recovery nahi lagti — amount 0 hi rahega.',
                422,
                'CLEARANCE_AMOUNT_NOT_ALLOWED'
            );
        }

        $clearance->forceFill([
            'status' => $status,
            'remarks' => $data['remarks'] ?? null,
            'recoverable_amount' => $amount,
            'cleared_by' => $actor->id,
            'cleared_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        $this->flush();

        return $clearance->refresh()->load('clearedBy');
    }

    public function forExit(EmployeeExit $exit): array
    {
        $rows = ExitClearance::query()
            ->with('clearedBy')
            ->where('employee_exit_id', $exit->id)
            ->orderBy('department')
            ->orderBy('id')
            ->get();

        $departments = [];

        foreach ($rows as $row) {
            $departments[$row->department][] = $row;
        }

        return [
            'summary' => $this->summary($exit),
            'departments' => $departments,
            'items' => $rows,
        ];
    }

    public function summary(EmployeeExit $exit): array
    {
        $row = DB::table('exit_clearances')
            ->where('employee_exit_id', $exit->id)
            ->where('is_active', 1)
            ->selectRaw("
                COUNT(*) as total,
                SUM(status = 'pending') as pending,
                SUM(status = 'cleared') as cleared,
                SUM(status = 'blocked') as blocked,
                SUM(status = 'not_applicable') as not_applicable,
                SUM(is_open) as open_mandatory,
                COALESCE(SUM(recoverable_amount), 0) as recoverable
            ")
            ->first();

        $total = (int) ($row->total ?? 0);
        $done = (int) ($row->cleared ?? 0) + (int) ($row->not_applicable ?? 0);

        return [
            'total' => $total,
            'pending' => (int) ($row->pending ?? 0),
            'cleared' => (int) ($row->cleared ?? 0),
            'blocked' => (int) ($row->blocked ?? 0),
            'not_applicable' => (int) ($row->not_applicable ?? 0),
            'open_mandatory' => (int) ($row->open_mandatory ?? 0),
            'is_complete' => $total === 0 || (int) ($row->open_mandatory ?? 0) === 0,
            'progress_percent' => $total === 0 ? 100 : (int) round($done / $total * 100),
            'recoverable_amount' => round((float) ($row->recoverable ?? 0), 2),
        ];
    }

    public function assertComplete(EmployeeExit $exit, array $data, User $actor): void
    {
        $summary = $this->summary($exit);

        if ($summary['is_complete']) {
            return;
        }

        $force = (bool) ($data['force'] ?? false);

        if (! $force) {
            throw new ApiException(
                $summary['open_mandatory'] . ' clearance item abhi pending hai. Pehle wo clear karo.',
                409,
                'CLEARANCE_PENDING'
            );
        }

        $this->assertPermission($actor, ClearanceItem::MANAGE_PERMISSION, 'clearance bypass karne');

        if (($data['force_reason'] ?? null) === null) {
            throw new ApiException(
                'Clearance bypass kar rahe ho to wajah likhni zaroori hai.',
                422,
                'CLEARANCE_FORCE_REASON_REQUIRED'
            );
        }

        $exit->forceFill([
            'clearance_forced_by' => $actor->id,
            'clearance_force_reason' => $data['force_reason'],
        ])->save();
    }

    public function assertCanIssueRelieving(EmployeeExit $exit): void
    {
        if ($this->summary($exit)['is_complete']) {
            return;
        }

        throw new ApiException(
            'Clearance pending hai — relieving letter abhi issue nahi hota.',
            409,
            'CLEARANCE_PENDING'
        );
    }

    public function pendingFor(User $actor): array
    {
        $canSignAll = $actor->isSuperAdmin() || $actor->hasPermission(ClearanceItem::SIGN_PERMISSION);

        $rows = DB::table('exit_clearances as c')
            ->join('employee_exits as x', 'x.id', '=', 'c.employee_exit_id')
            ->join('employees as e', 'e.id', '=', 'x.employee_id')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->where('c.company_id', $actor->company_id)
            ->where('c.is_active', 1)
            ->where('c.is_open', 1)
            ->where('x.status', EmployeeExit::SERVING_NOTICE)
            ->when(! $canSignAll, fn ($query) => $query
                ->where('c.department', ClearanceItem::MANAGER)
                ->where('e.reporting_manager_id', $actor->id))
            ->orderBy('x.last_working_date')
            ->orderBy('c.department')
            ->get([
                'c.uuid',
                'c.department',
                'c.title',
                'c.status',
                'x.uuid as exit_uuid',
                'x.last_working_date',
                'e.employee_code',
                'u.name as employee_name',
            ]);

        return $rows->map(fn ($row): array => [
            'uuid' => $row->uuid,
            'exit_uuid' => $row->exit_uuid,
            'department' => $row->department,
            'title' => $row->title,
            'status' => $row->status,
            'employee_code' => $row->employee_code,
            'employee_name' => $row->employee_name,
            'last_working_date' => $row->last_working_date,
        ])->all();
    }

    private function assertCanSign(ExitClearance $clearance, EmployeeExit $exit, User $actor): void
    {
        if ((int) $exit->employee->user_id === (int) $actor->id && ! $actor->isSuperAdmin()) {
            throw new ApiException('Apni clearance khud sign nahi kar sakte.', 403, 'CLEARANCE_SELF_SIGN');
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(ClearanceItem::SIGN_PERMISSION)) {
            return;
        }

        if ($clearance->department === ClearanceItem::MANAGER
            && (int) $exit->employee->reporting_manager_id === (int) $actor->id) {
            return;
        }

        throw new ApiException('Ye item sign karne ka haq nahi hai.', 403, 'FORBIDDEN');
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
        TenantCache::flush(TenantCache::EXITS);
    }

    private function notifySignOff(EmployeeExit $exit, int $count, ?User $actor): void
    {
        $recipients = Recipients::except(
            array_merge(
                Recipients::withPermission((int) $exit->company_id, ClearanceItem::SIGN_PERMISSION),
                [(int) ($exit->employee->reporting_manager_id ?? 0)]
            ),
            [(int) $exit->employee->user_id, (int) ($actor?->id ?? 0)]
        );

        if ($recipients === []) {
            return;
        }

        $name = $exit->employee->user?->name ?? $exit->employee->employee_code;

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::CLEARANCE_PENDING,
            'title' => $name . ' ka clearance shuru ho gaya',
            'body' => $count . ' item sign karne hain — last working day '
                . $exit->last_working_date?->format('d M Y') . '.',
            'action_url' => '/exits/' . $exit->uuid . '/clearance',
            'entity_type' => 'employee_exit',
            'entity_id' => $exit->id,
            'payload' => ['exit_id' => $exit->id, 'items' => $count],
            'dedupe_key' => 'clearance:' . $exit->id . ':generated',
        ], $actor);
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\Policy;
use App\Models\PolicyAcknowledgement;
use App\Models\User;
use App\Support\NotificationType;
use App\Support\Recipients;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class PolicyService
{
    private const DISK = 'local';

    public function __construct(private readonly NotificationService $notifications) {}

    public function create(array $data, ?UploadedFile $file, User $actor, ?int $companyId): Policy
    {
        $this->assertPermission($actor, 'policy banane');

        if ($companyId === null) {
            throw new ApiException('Policy company ki hoti hai. X-Company-Id bhejo.', 422, 'TENANT_REQUIRED');
        }

        if ($file === null && ($data['body'] ?? null) === null) {
            throw new ApiException(
                'Policy ka content do — ya text likho ya PDF upload karo.',
                422,
                'POLICY_CONTENT_REQUIRED'
            );
        }

        return DB::transaction(function () use ($data, $file, $actor, $companyId): Policy {
            $policy = new Policy($data);
            $policy->company_id = $companyId;
            $policy->created_by = $actor->id;
            $policy->save();

            if ($file !== null) {
                $this->storeFile($policy, $file);
            }

            $this->flush();

            return $policy->refresh();
        });
    }

    public function update(Policy $policy, array $data, ?UploadedFile $file, User $actor): Policy
    {
        $this->assertPermission($actor, 'policy badalne');

        if (! $policy->isDraft()) {
            throw new ApiException(
                'Published policy edit nahi hoti — nayi version banao.',
                409,
                'POLICY_PUBLISHED'
            );
        }

        return DB::transaction(function () use ($policy, $data, $file, $actor): Policy {
            $policy->fill($data);
            $policy->updated_by = $actor->id;
            $policy->save();

            if ($file !== null) {
                $this->deleteFile($policy);
                $this->storeFile($policy, $file);
            }

            $this->flush();

            return $policy->refresh();
        });
    }

    public function publish(Policy $policy, User $actor): array
    {
        $this->assertPermission($actor, 'policy publish karne');

        if (! $policy->isDraft()) {
            throw new ApiException('Ye policy already ' . $policy->status . ' hai.', 409, 'POLICY_WRONG_STAGE');
        }

        $result = DB::transaction(function () use ($policy, $actor): array {
            $this->archiveOlderVersions($policy, $actor);

            $policy->forceFill([
                'status' => Policy::PUBLISHED,
                'published_by' => $actor->id,
                'published_at' => Carbon::now(),
                'updated_by' => $actor->id,
            ])->save();

            $created = $policy->needs_ack ? $this->assignToEmployees($policy, $actor) : 0;

            $this->flush();

            return ['assigned' => $created];
        });

        if ($policy->needs_ack) {
            $this->notifyPublished($policy, $actor);
        }

        return array_merge($result, ['policy' => $policy->refresh()]);
    }

    public function archive(Policy $policy, User $actor): Policy
    {
        $this->assertPermission($actor, 'policy archive karne');

        $policy->forceFill([
            'status' => Policy::ARCHIVED,
            'archived_at' => Carbon::now(),
            'updated_by' => $actor->id,
        ])->save();

        PolicyAcknowledgement::query()
            ->where('policy_id', $policy->id)
            ->where('status', PolicyAcknowledgement::PENDING)
            ->update(['is_active' => 0]);

        $this->flush();

        return $policy->refresh();
    }

    public function delete(Policy $policy, User $actor): void
    {
        $this->assertPermission($actor, 'policy hataane');

        if (! $policy->isDraft()) {
            throw new ApiException(
                'Published policy delete nahi hoti — archive karo, record rehna chahiye.',
                409,
                'POLICY_PUBLISHED'
            );
        }

        $this->deleteFile($policy);
        $policy->deactivate();
        $this->flush();
    }

    public function acknowledge(Policy $policy, array $data, User $actor, ?string $ip): PolicyAcknowledgement
    {
        $employee = $this->employeeFor($actor);

        $ack = PolicyAcknowledgement::query()
            ->where('policy_id', $policy->id)
            ->where('employee_id', $employee->id)
            ->first();

        if ($ack === null) {
            throw new ApiException('Ye policy aapko assign nahi hui.', 404, 'NOT_FOUND');
        }

        if (! $ack->isPending()) {
            throw new ApiException('Ye policy aap already accept kar chuke ho.', 409, 'POLICY_ALREADY_ACKNOWLEDGED');
        }

        DB::transaction(function () use ($ack, $data, $ip, $actor, $employee): void {
            $ack->forceFill([
                'status' => PolicyAcknowledgement::ACKNOWLEDGED,
                'acknowledged_at' => Carbon::now(),
                'ip_address' => $ip,
                'note' => $data['note'] ?? null,
                'updated_by' => $actor->id,
            ])->save();

            $this->clearGateIfDone($employee, $actor);
            $this->flush();
        });

        return $ack->refresh()->load('policy');
    }

    public function myPolicies(User $actor): array
    {
        $employee = $this->employeeFor($actor);

        $rows = PolicyAcknowledgement::query()
            ->with('policy')
            ->where('employee_id', $employee->id)
            ->get()
            ->filter(fn (PolicyAcknowledgement $ack): bool => $ack->policy !== null);

        $pending = $rows->where('status', PolicyAcknowledgement::PENDING)->values();
        $done = $rows->where('status', PolicyAcknowledgement::ACKNOWLEDGED)->values();

        return [
            'total' => $rows->count(),
            'pending' => $pending->count(),
            'acknowledged' => $done->count(),
            'gate_cleared' => $employee->hasClearedPolicyGate(),
            'items' => $rows->sortBy([
                fn ($a, $b): int => $a->status <=> $b->status,
                fn ($a, $b): int => $a->id <=> $b->id,
            ])->values()->all(),
        ];
    }

    /**
     * Naya employee ban-te hi uske paas saari published policies aa jaati hain.
     */
    public function assignPending(Employee $employee, ?User $actor = null): int
    {
        $existing = PolicyAcknowledgement::query()
            ->where('employee_id', $employee->id)
            ->pluck('policy_id')
            ->all();

        $policies = Policy::query()
            ->where('company_id', $employee->company_id)
            ->where('status', Policy::PUBLISHED)
            ->where('needs_ack', 1)
            ->when($existing !== [], fn ($query) => $query->whereNotIn('id', $existing))
            ->get();

        $count = 0;

        foreach ($policies as $policy) {
            $this->makeAcknowledgement($policy, $employee, $actor);
            $count++;
        }

        if ($count > 0) {
            $this->flush();
        }

        return $count;
    }

    public function compliance(Policy $policy, User $actor): array
    {
        $this->assertPermission($actor, 'compliance dekhne');

        $counts = DB::table('policy_acknowledgements')
            ->where('policy_id', $policy->id)
            ->where('is_active', 1)
            ->selectRaw("
                COUNT(*) as total,
                SUM(status = 'acknowledged') as done,
                SUM(status = 'pending') as pending,
                SUM(status = 'pending' AND due_on IS NOT NULL AND due_on < CURDATE()) as overdue
            ")
            ->first();

        $rows = DB::table('policy_acknowledgements as a')
            ->join('employees as e', 'e.id', '=', 'a.employee_id')
            ->join('users as u', 'u.id', '=', 'e.user_id')
            ->where('a.policy_id', $policy->id)
            ->where('a.is_active', 1)
            ->orderBy('a.status')
            ->orderBy('u.name')
            ->get(['a.status', 'a.due_on', 'a.acknowledged_at', 'e.employee_code', 'u.name as employee_name']);

        $total = (int) ($counts->total ?? 0);
        $done = (int) ($counts->done ?? 0);

        return [
            'policy' => [
                'uuid' => $policy->uuid,
                'title' => $policy->title,
                'version' => $policy->version,
                'status' => $policy->status,
            ],
            'total' => $total,
            'acknowledged' => $done,
            'pending' => (int) ($counts->pending ?? 0),
            'overdue' => (int) ($counts->overdue ?? 0),
            'compliance_percent' => $total === 0 ? 100 : (int) round($done / $total * 100),
            'employees' => $rows->map(fn ($row): array => [
                'employee_code' => $row->employee_code,
                'employee_name' => $row->employee_name,
                'status' => $row->status,
                'due_on' => $row->due_on,
                'acknowledged_at' => $row->acknowledged_at,
            ])->all(),
        ];
    }

    public function download(Policy $policy): StreamedResponse
    {
        if ($policy->file_path === null || ! Storage::disk(self::DISK)->exists($policy->file_path)) {
            throw new ApiException('Is policy ki file available nahi hai.', 404, 'FILE_MISSING');
        }

        return Storage::disk(self::DISK)->download($policy->file_path, $policy->original_name);
    }

    /**
     * Gate sirf naye employee par lagta hai — jisne ek baar sab accept kar liya,
     * uska kaam nayi policy aane par nahi rukta.
     */
    public function gateStatus(User $actor): array
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission(Policy::MANAGE_PERMISSION)) {
            return ['blocked' => false, 'pending' => 0, 'enabled' => false];
        }

        $enabled = (bool) DB::table('companies')
            ->where('id', $actor->company_id)
            ->value('policy_gate_enabled');

        $employee = Employee::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $actor->company_id)
            ->where('user_id', $actor->id)
            ->first();

        if ($employee === null) {
            return ['blocked' => false, 'pending' => 0, 'enabled' => $enabled];
        }

        $pending = (int) PolicyAcknowledgement::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('employee_id', $employee->id)
            ->where('status', PolicyAcknowledgement::PENDING)
            ->count();

        return [
            'blocked' => $enabled && ! $employee->hasClearedPolicyGate() && $pending > 0,
            'pending' => $pending,
            'enabled' => $enabled,
        ];
    }

    private function clearGateIfDone(Employee $employee, User $actor): void
    {
        $pending = PolicyAcknowledgement::query()
            ->where('employee_id', $employee->id)
            ->where('status', PolicyAcknowledgement::PENDING)
            ->exists();

        if ($pending) {
            return;
        }

        if (! $employee->hasClearedPolicyGate()) {
            $employee->forceFill(['policy_gate_cleared_at' => Carbon::now()])->save();
        }

        app(ClearanceService::class)->clearPolicyItems((int) $employee->id, $actor);
    }

    private function assignToEmployees(Policy $policy, User $actor): int
    {
        $employees = Employee::query()
            ->where('company_id', $policy->company_id)
            ->where('employment_status', '!=', Employee::EMPLOYMENT_EXITED)
            ->get(['id', 'company_id', 'user_id']);

        $count = 0;

        foreach ($employees as $employee) {
            $this->makeAcknowledgement($policy, $employee, $actor);
            $count++;
        }

        return $count;
    }

    private function makeAcknowledgement(Policy $policy, Employee $employee, ?User $actor): void
    {
        $ack = new PolicyAcknowledgement();
        $ack->company_id = $policy->company_id;
        $ack->policy_id = $policy->id;
        $ack->employee_id = $employee->id;
        $ack->due_on = Carbon::today()->addDays((int) $policy->ack_due_days)->toDateString();
        $ack->created_by = $actor?->id;
        $ack->save();
    }

    private function archiveOlderVersions(Policy $policy, User $actor): void
    {
        Policy::query()
            ->where('company_id', $policy->company_id)
            ->where('title', $policy->title)
            ->where('status', Policy::PUBLISHED)
            ->whereKeyNot($policy->id)
            ->get()
            ->each(function (Policy $old) use ($actor): void {
                $old->forceFill([
                    'status' => Policy::ARCHIVED,
                    'archived_at' => Carbon::now(),
                    'updated_by' => $actor->id,
                ])->save();

                PolicyAcknowledgement::query()
                    ->where('policy_id', $old->id)
                    ->where('status', PolicyAcknowledgement::PENDING)
                    ->update(['is_active' => 0]);
            });
    }

    private function storeFile(Policy $policy, UploadedFile $file): void
    {
        $path = $file->storeAs(
            'policies/' . $policy->company_id,
            Str::uuid()->toString() . '.' . strtolower($file->getClientOriginalExtension() ?: 'pdf'),
            self::DISK
        );

        $policy->forceFill([
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize() ?: 0,
        ])->save();
    }

    private function deleteFile(Policy $policy): void
    {
        if ($policy->file_path !== null && Storage::disk(self::DISK)->exists($policy->file_path)) {
            Storage::disk(self::DISK)->delete($policy->file_path);
        }
    }

    private function employeeFor(User $actor): Employee
    {
        $employee = Employee::query()->where('user_id', $actor->id)->first();

        if ($employee === null) {
            throw new ApiException(
                'Policy accept karne ke liye employee record chahiye. HR se baat karo.',
                422,
                'EMPLOYEE_RECORD_MISSING'
            );
        }

        return $employee;
    }

    private function assertPermission(User $actor, string $what): void
    {
        if ($actor->isSuperAdmin() || $actor->hasPermission(Policy::MANAGE_PERMISSION)) {
            return;
        }

        throw new ApiException('Aapke paas ' . $what . ' ka haq nahi hai.', 403, 'FORBIDDEN');
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::POLICIES, TenantCache::EMPLOYEES);
    }

    private function notifyPublished(Policy $policy, User $actor): void
    {
        $recipients = Recipients::except(
            Recipients::activeUsers((int) $policy->company_id),
            [(int) $actor->id]
        );

        if ($recipients === []) {
            return;
        }

        $this->notifications->sendMany($recipients, [
            'type' => NotificationType::POLICY_PUBLISHED,
            'title' => 'Nayi policy — accept karni hai',
            'body' => $policy->title . ' (v' . $policy->version . ') · '
                . $policy->ack_due_days . ' din me accept kar do.',
            'action_url' => '/my-policies',
            'entity_type' => 'policy',
            'entity_id' => $policy->id,
            'payload' => [
                'policy_id' => $policy->id,
                'title' => $policy->title,
                'version' => $policy->version,
            ],
            'dedupe_key' => 'policy:' . $policy->id . ':published',
        ], $actor);
    }
}

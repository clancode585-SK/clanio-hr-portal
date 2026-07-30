<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Employee;
use Illuminate\Support\Facades\DB;

final class Recipients
{
    public static function withPermission(int $companyId, string $slug): array
    {
        return TenantCache::remember(
            TenantCache::PERMISSIONS,
            'recipients:' . $companyId . ':' . $slug,
            fn (): array => DB::table('users as u')
                ->join('user_roles as ur', 'ur.user_id', '=', 'u.id')
                ->join('roles as r', 'r.id', '=', 'ur.role_id')
                ->join('role_permissions as rp', 'rp.role_id', '=', 'r.id')
                ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
                ->where('u.company_id', $companyId)
                ->where('u.status', 'active')
                ->whereNull('u.deleted_at')
                ->where('r.is_active', 1)
                ->whereNull('r.deleted_at')
                ->where('p.slug', $slug)
                ->distinct()
                ->pluck('u.id')
                ->map(fn ($id): int => (int) $id)
                ->all()
        );
    }

    public static function approversFor(Employee $employee, string $slug): array
    {
        $managerId = $employee->reporting_manager_id === null ? null : (int) $employee->reporting_manager_id;

        $recipients = $managerId === null
            ? self::withPermission((int) $employee->company_id, $slug)
            : [$managerId];

        return self::except($recipients, [(int) $employee->user_id]);
    }

    public static function activeUsers(int $companyId, array $filters = []): array
    {
        return DB::table('users')
            ->where('company_id', $companyId)
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->when(isset($filters['branch_id']), fn ($query) => $query->where('branch_id', $filters['branch_id']))
            ->when(isset($filters['department_id']), fn ($query) => $query->where('department_id', $filters['department_id']))
            ->when(isset($filters['team_id']), fn ($query) => $query->where('team_id', $filters['team_id']))
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    public static function except(array $userIds, array $excluded): array
    {
        $excluded = array_map('intval', $excluded);

        return array_values(array_filter(
            array_unique(array_map('intval', $userIds)),
            fn (int $id): bool => $id > 0 && ! in_array($id, $excluded, true)
        ));
    }
}

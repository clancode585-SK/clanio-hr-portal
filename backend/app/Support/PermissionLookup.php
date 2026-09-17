<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PermissionLookup
{
    public static function userIdsWith(string $slug, int $companyId): array
    {
        if (self::moduleDisabled($slug, $companyId)) {
            return self::superAdminIds();
        }

        $fromRoles = DB::table('user_roles as ur')
            ->join('roles as r', 'r.id', '=', 'ur.role_id')
            ->join('role_permissions as rp', 'rp.role_id', '=', 'r.id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->join('users as u', 'u.id', '=', 'ur.user_id')
            ->where('u.company_id', $companyId)
            ->where('u.is_active', 1)
            ->where('u.status', 'active')
            ->where('r.is_active', 1)
            ->where('p.slug', $slug)
            ->distinct()
            ->pluck('u.id');

        $fromDepartments = DB::table('department_permissions as dp')
            ->join('permissions as p', 'p.id', '=', 'dp.permission_id')
            ->join('users as u', 'u.department_id', '=', 'dp.department_id')
            ->where('u.company_id', $companyId)
            ->where('u.is_active', 1)
            ->where('u.status', 'active')
            ->where('p.slug', $slug)
            ->distinct()
            ->pluck('u.id');

        $granted = self::overrideIds($slug, $companyId, 'grant');
        $revoked = self::overrideIds($slug, $companyId, 'revoke');

        $ids = $fromRoles
            ->merge($fromDepartments)
            ->merge($granted)
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->reject(fn (int $id): bool => in_array($id, $revoked, true))
            ->values()
            ->all();

        return array_values(array_unique(array_merge($ids, self::superAdminIds())));
    }

    public static function firstUserIdWith(string $slug, int $companyId, ?int $notThisUser = null): ?int
    {
        foreach (self::userIdsWith($slug, $companyId) as $id) {
            if ($notThisUser === null || $id !== $notThisUser) {
                return $id;
            }
        }

        return null;
    }

    private static function overrideIds(string $slug, int $companyId, string $effect): array
    {
        return DB::table('user_permissions as up')
            ->join('permissions as p', 'p.id', '=', 'up.permission_id')
            ->join('users as u', 'u.id', '=', 'up.user_id')
            ->where('u.company_id', $companyId)
            ->where('u.is_active', 1)
            ->where('p.slug', $slug)
            ->where('up.effect', $effect)
            ->pluck('u.id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    private static function superAdminIds(): array
    {
        return DB::table('users')
            ->whereNull('company_id')
            ->where('is_active', 1)
            ->where('status', 'active')
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    private static function moduleDisabled(string $slug, int $companyId): bool
    {
        return DB::table('company_modules')
            ->where('company_id', $companyId)
            ->where('module', Str::before($slug, '.'))
            ->where('is_enabled', 0)
            ->exists();
    }
}

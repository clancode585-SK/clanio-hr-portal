<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

final class DataScope
{
    public const ALL_COMPANY = 'all_company';

    public const BRANCH = 'branch';

    public const DEPARTMENT = 'department';

    public const TEAM = 'team';

    public const SELF = 'self';

    public const LEVELS = [self::ALL_COMPANY, self::BRANCH, self::DEPARTMENT, self::TEAM, self::SELF];

    public const OVERRIDE = 'user.view_all';

    public static function of(User $actor): string
    {
        if ($actor->isSuperAdmin()) {
            return self::ALL_COMPANY;
        }

        $scopes = TenantCache::remember(
            TenantCache::PERMISSIONS,
            'data-scope:' . $actor->id,
            fn (): array => DB::table('roles')
                ->join('user_roles', 'user_roles.role_id', '=', 'roles.id')
                ->where('user_roles.user_id', $actor->id)
                ->where('roles.is_active', 1)
                ->whereNull('roles.deleted_at')
                ->distinct()
                ->pluck('roles.data_scope')
                ->all()
        );

        $widest = self::SELF;

        foreach ($scopes as $scope) {
            if (in_array($scope, self::LEVELS, true) && self::rank($scope) < self::rank($widest)) {
                $widest = $scope;
            }
        }

        return $widest;
    }

    public static function apply(Builder $query, ?User $actor): Builder
    {
        if ($actor === null) {
            return $query;
        }

        if ($actor->isSuperAdmin() || $actor->hasPermission(self::OVERRIDE)) {
            return $query;
        }

        return match (self::of($actor)) {
            self::ALL_COMPANY => $query,
            self::BRANCH => self::within($query, $actor, 'branch_id', $actor->branch_id),
            self::DEPARTMENT => self::within($query, $actor, 'department_id', $actor->department_id),
            self::TEAM => self::within($query, $actor, 'team_id', $actor->team_id),
            default => $query->whereKey($actor->id),
        };
    }

    private static function within(Builder $query, User $actor, string $column, ?int $value): Builder
    {
        if ($value === null) {
            return $query->whereKey($actor->id);
        }

        return $query->where(fn (Builder $inner) => $inner
            ->where($query->qualifyColumn($column), $value)
            ->orWhere($query->qualifyColumn($actor->getKeyName()), $actor->id));
    }

    private static function rank(string $scope): int
    {
        $rank = array_search($scope, self::LEVELS, true);

        return $rank === false ? count(self::LEVELS) : $rank;
    }
}

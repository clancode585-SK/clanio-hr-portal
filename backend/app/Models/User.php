<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use App\Support\DataScope;
use App\Support\TenantCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'branch_id',
        'department_id',
        'team_id',
        'status',
    ];

    protected $attributes = [
        'status' => 'active',
        'is_super_admin' => false,
        'failed_login_attempts' => 0,
    ];

    protected $hidden = ['password', 'company_key'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_super_admin' => 'boolean',
            'failed_login_attempts' => 'integer',
            'last_login_at' => 'datetime',
            'locked_until' => 'datetime',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function tokens(): HasMany
    {
        return $this->hasMany(ApiToken::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class);
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path === null ? null : Storage::disk('public')->url($this->avatar_path);
    }

    public function scopeVisibleTo(Builder $query, ?User $actor): Builder
    {
        return DataScope::apply($query, $actor);
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->resolveRouteBindingQuery(
            $this->newQuery()->visibleTo(auth()->user()),
            $value,
            $field
        )->firstOrFail();
    }

    public function isSuperAdmin(): bool
    {
        return $this->is_super_admin === true;
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    public function primaryRole(): ?string
    {
        return DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $this->id)
            ->orderBy('roles.hierarchy_level')
            ->value('roles.slug');
    }

    public function permissionSlugs(): array
    {
        if ($this->isSuperAdmin()) {
            return TenantCache::remember(
                TenantCache::PERMISSIONS,
                'super-admin',
                fn (): array => Permission::query()->pluck('slug')->all()
            );
        }

        return TenantCache::remember(TenantCache::PERMISSIONS, (string) $this->id, function (): array {
            $fromRoles = DB::table('permissions')
                ->join('role_permissions', 'role_permissions.permission_id', '=', 'permissions.id')
                ->join('roles', 'roles.id', '=', 'role_permissions.role_id')
                ->join('user_roles', 'user_roles.role_id', '=', 'roles.id')
                ->where('user_roles.user_id', $this->id)
                ->where('roles.is_active', 1)
                ->distinct()
                ->pluck('permissions.slug')
                ->all();

            $fromDepartment = $this->department_id === null ? [] : DB::table('permissions')
                ->join('department_permissions as dp', 'dp.permission_id', '=', 'permissions.id')
                ->where('dp.department_id', $this->department_id)
                ->distinct()
                ->pluck('permissions.slug')
                ->all();

            $overrides = DB::table('user_permissions as up')
                ->join('permissions as p', 'p.id', '=', 'up.permission_id')
                ->where('up.user_id', $this->id)
                ->get(['p.slug', 'up.effect']);

            $granted = $overrides->where('effect', 'grant')->pluck('slug')->all();
            $revoked = $overrides->where('effect', 'revoke')->pluck('slug')->all();

            $default = array_unique(array_merge($fromRoles, $fromDepartment));
            $effective = array_diff(array_merge($default, $granted), $revoked);

            return array_values($this->withinEnabledModules($effective));
        });
    }

    /**
     * Super admin ne jo module company ke liye band kiya hai, uski permission
     * effective list se apne aap nikal jati hai.
     */
    private function withinEnabledModules(array $slugs): array
    {
        if ($slugs === [] || $this->company_id === null) {
            return $slugs;
        }

        $disabled = DB::table('company_modules')
            ->where('company_id', $this->company_id)
            ->where('is_enabled', 0)
            ->pluck('module')
            ->all();

        if ($disabled === []) {
            return $slugs;
        }

        return array_filter(
            $slugs,
            static fn (string $slug): bool => ! in_array(Str::before($slug, '.'), $disabled, true)
        );
    }

    public function hasPermission(string $slug): bool
    {
        return $this->isSuperAdmin() || in_array($slug, $this->permissionSlugs(), true);
    }

    public function lowestRoleLevel(): int
    {
        return (int) (DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $this->id)
            ->min('roles.hierarchy_level') ?? 99);
    }

    public function registerLogin(?string $ip): void
    {
        $this->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $ip,
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->saveQuietly();
    }

    public function registerFailedLogin(int $maxAttempts, int $lockMinutes): void
    {
        $attempts = $this->failed_login_attempts + 1;

        $this->forceFill([
            'failed_login_attempts' => $attempts,
            'locked_until' => $attempts >= $maxAttempts ? now()->addMinutes($lockMinutes) : $this->locked_until,
        ])->saveQuietly();
    }

    public function revokeTokens(): void
    {
        $this->tokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }
}

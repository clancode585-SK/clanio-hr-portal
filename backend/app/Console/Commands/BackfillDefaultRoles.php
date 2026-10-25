<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\RoleTemplates;
use Illuminate\Console\Command;

/**
 * Ek baar ka script — purani companies ko bhi wahi 5 default role de deta hai
 * jo ab naye company create karte waqt apne aap ban jaate hain.
 */
final class BackfillDefaultRoles extends Command
{
    protected $signature = 'roles:backfill-defaults';

    protected $description = 'Add the standard Member/Team Lead/Manager/HR Manager roles to companies that do not have them yet';

    public function handle(): int
    {
        $permissionIds = Permission::query()->pluck('id', 'slug');

        Company::query()->each(function (Company $company) use ($permissionIds): void {
            $actor = User::query()
                ->withoutGlobalScopes()
                ->where('company_id', $company->id)
                ->whereHas('roles', fn ($q) => $q->withoutGlobalScopes()->where('slug', Role::COMPANY_ADMIN))
                ->first();

            if ($actor === null) {
                $this->warn("Company {$company->id} ({$company->name}): koi admin user nahi mila, skip");

                return;
            }

            foreach (RoleTemplates::defaults() as $slug => $template) {
                $exists = Role::query()->withoutGlobalScopes()->where('company_id', $company->id)->where('slug', $slug)->exists();

                if ($exists) {
                    continue;
                }

                $role = new Role([
                    'name' => $template['name'],
                    'slug' => $slug,
                    'hierarchy_level' => $template['hierarchy_level'],
                    'data_scope' => $template['data_scope'],
                ]);
                $role->company_id = $company->id;
                $role->is_system = false;
                $role->created_by = $actor->id;
                $role->save();

                $ids = collect($template['permissions'])
                    ->map(fn (string $permSlug) => $permissionIds->get($permSlug))
                    ->filter()
                    ->all();

                $role->permissions()->sync($ids);

                $this->info("Company {$company->id} ({$company->name}): '{$slug}' bana diya (" . count($ids) . ' permissions)');
            }
        });

        return self::SUCCESS;
    }
}

<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Team;
use App\Models\User;
use App\Support\TenantCache;

final class TeamService
{
    public function create(array $data, User $actor, ?int $companyId): Team
    {
        $targetCompanyId = $companyId ?? $actor->company_id ?? 1;

        $team = new Team($data);
        $team->company_id = $targetCompanyId;
        $team->created_by = $actor->id;
        $team->save();

        TenantCache::flush(TenantCache::TEAMS);

        return $team->load('department');
    }

    public function update(Team $team, array $data, User $actor): Team
    {
        $team->fill($data);
        $team->updated_by = $actor->id;
        $team->save();

        if ($team->wasChanged('department_id')) {
            User::query()->where('team_id', $team->id)->update(['department_id' => $team->department_id]);

            TenantCache::flush(TenantCache::USERS);
        }

        TenantCache::flush(TenantCache::TEAMS);

        return $team->refresh()->load('department');
    }

    public function delete(Team $team): void
    {
        if ($team->users()->exists()) {
            throw new ApiException('This team has users. Move them before deleting it.', 409, 'TEAM_IN_USE');
        }

        $team->delete();

        TenantCache::flush(TenantCache::TEAMS);
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\TeamRequest;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use App\Services\TeamService;
use App\Support\ApiResponse;
use App\Support\TenantCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController extends ApiController
{
    public function __construct(private readonly TeamService $teams) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Team::query();

        if ($user?->isSuperAdmin() && app(\App\Support\TenantContext::class)->id() === null) {
            $query = Team::withoutGlobalScopes();
        }

        $teams = TenantCache::remember(
            TenantCache::TEAMS,
            $this->cacheKey($request) . ($user?->isSuperAdmin() ? '_super' : ''),
            fn () => $this->applyFilters(
                $query->with('department')->withCount('users'),
                $request,
                ['name', 'code'],
                ['status' => 'status', 'department_id' => 'department_id']
            )->orderBy('name')->paginate($this->perPage($request))
        );

        return ApiResponse::paginated($teams, TeamResource::class, 'Teams fetched successfully');
    }

    public function store(TeamRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new TeamResource($this->teams->create($request->validated(), $request->user(), $this->tenantId())),
            'Team created successfully'
        );
    }

    public function show(Team $team): JsonResponse
    {
        return ApiResponse::success(
            new TeamResource($team->load('department')->loadCount('users')),
            'Team details fetched successfully'
        );
    }

    public function update(TeamRequest $request, Team $team): JsonResponse
    {
        return ApiResponse::success(
            new TeamResource($this->teams->update($team, $request->validated(), $request->user())),
            'Team updated successfully'
        );
    }

    public function destroy(Team $team): JsonResponse
    {
        $this->teams->delete($team);

        return ApiResponse::success(null, 'Team deleted successfully');
    }
}

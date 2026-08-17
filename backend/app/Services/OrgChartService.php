<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Employee;
use Illuminate\Support\Facades\DB;

final class OrgChartService
{
    public const DEPTH_BRANCH = 'branch';

    public const DEPTH_DEPARTMENT = 'department';

    public const DEPTH_TEAM = 'team';

    public const DEPTH_EMPLOYEE = 'employee';

    public const DEPTHS = [self::DEPTH_BRANCH, self::DEPTH_DEPARTMENT, self::DEPTH_TEAM, self::DEPTH_EMPLOYEE];

    private const UNASSIGNED = 0;

    public function build(int $companyId, ?int $branchId = null, string $depth = self::DEPTH_EMPLOYEE, bool $includeExited = false): array
    {
        $depth = in_array($depth, self::DEPTHS, true) ? $depth : self::DEPTH_EMPLOYEE;

        $company = $this->company($companyId);
        $branches = $this->branches($companyId, $branchId);
        $departments = $this->departments($companyId);
        $teams = $this->teams($companyId);
        $people = $this->people($companyId, $includeExited);

        $tree = [];

        foreach ($branches as $branch) {
            $tree[] = $this->branchNode($branch, $departments, $teams, $people, $depth);
        }

        $unassigned = $this->unassignedNode($people, $branchId);

        return [
            'company' => $company + [
                'branch_count' => count($branches),
                'department_count' => count($departments),
                'team_count' => count($teams),
                'employee_count' => count($people),
            ],
            'depth' => $depth,
            'branches' => $tree,
            'unassigned' => $unassigned,
        ];
    }

    private function branchNode(array $branch, array $departments, array $teams, array $people, string $depth): array
    {
        $branchPeople = $this->filter($people, 'branch_id', (int) $branch['id']);

        $node = [
            'id' => (int) $branch['id'],
            'uuid' => $branch['uuid'],
            'name' => $branch['name'],
            'code' => $branch['code'],
            'is_head_office' => (bool) $branch['is_head_office'],
            'employee_count' => count($branchPeople),
        ];

        if ($depth === self::DEPTH_BRANCH) {
            return $node;
        }

        $node['departments'] = [];

        foreach ($departments as $department) {
            if (! $this->departmentBelongs($department, (int) $branch['id'], $branchPeople)) {
                continue;
            }

            $node['departments'][] = $this->departmentNode($department, $teams, $branchPeople, $depth);
        }

        $loose = $this->filter($branchPeople, 'department_id', self::UNASSIGNED);

        $node['employees_without_department'] = $depth === self::DEPTH_EMPLOYEE ? $loose : [];
        $node['without_department_count'] = count($loose);

        return $node;
    }

    private function departmentNode(array $department, array $teams, array $branchPeople, string $depth): array
    {
        $departmentPeople = $this->filter($branchPeople, 'department_id', (int) $department['id']);

        $node = [
            'id' => (int) $department['id'],
            'uuid' => $department['uuid'],
            'name' => $department['name'],
            'code' => $department['code'],
            'employee_count' => count($departmentPeople),
        ];

        if ($depth === self::DEPTH_DEPARTMENT) {
            return $node;
        }

        $node['teams'] = [];

        foreach ($teams as $team) {
            if ((int) $team['department_id'] !== (int) $department['id']) {
                continue;
            }

            $teamPeople = $this->filter($departmentPeople, 'team_id', (int) $team['id']);

            $teamNode = [
                'id' => (int) $team['id'],
                'uuid' => $team['uuid'],
                'name' => $team['name'],
                'code' => $team['code'],
                'employee_count' => count($teamPeople),
            ];

            if ($depth === self::DEPTH_EMPLOYEE) {
                $teamNode['employees'] = $teamPeople;
            }

            $node['teams'][] = $teamNode;
        }

        $loose = $this->filter($departmentPeople, 'team_id', self::UNASSIGNED);

        $node['employees_without_team'] = $depth === self::DEPTH_EMPLOYEE ? $loose : [];
        $node['without_team_count'] = count($loose);

        return $node;
    }

    private function unassignedNode(array $people, ?int $branchId): array
    {
        if ($branchId !== null) {
            return ['employee_count' => 0, 'employees' => []];
        }

        $loose = $this->filter($people, 'branch_id', self::UNASSIGNED);

        return ['employee_count' => count($loose), 'employees' => $loose];
    }

    private function departmentBelongs(array $department, int $branchId, array $branchPeople): bool
    {
        if ($department['branch_id'] !== null) {
            return (int) $department['branch_id'] === $branchId;
        }

        foreach ($branchPeople as $person) {
            if ($person['department_id'] === (int) $department['id']) {
                return true;
            }
        }

        return false;
    }

    private function filter(array $people, string $key, int $value): array
    {
        return array_values(array_filter($people, fn (array $person): bool => $person[$key] === $value));
    }

    private function company(int $companyId): array
    {
        $company = DB::table('companies')->where('id', $companyId)->first(['id', 'uuid', 'name', 'logo_url']);

        return [
            'id' => (int) $companyId,
            'uuid' => $company->uuid ?? null,
            'name' => $company->name ?? null,
            'logo_url' => $company->logo_url ?? null,
        ];
    }

    private function branches(int $companyId, ?int $branchId): array
    {
        return DB::table('branches')
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->when($branchId !== null, fn ($query) => $query->where('id', $branchId))
            ->orderByDesc('is_head_office')
            ->orderBy('name')
            ->get(['id', 'uuid', 'name', 'code', 'is_head_office'])
            ->map(fn ($row): array => (array) $row)
            ->all();
    }

    private function departments(int $companyId): array
    {
        return DB::table('departments')
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->orderBy('name')
            ->get(['id', 'uuid', 'name', 'code', 'branch_id'])
            ->map(fn ($row): array => (array) $row)
            ->all();
    }

    private function teams(int $companyId): array
    {
        return DB::table('teams')
            ->where('company_id', $companyId)
            ->where('is_active', 1)
            ->orderBy('name')
            ->get(['id', 'uuid', 'name', 'code', 'department_id'])
            ->map(fn ($row): array => (array) $row)
            ->all();
    }

    private function people(int $companyId, bool $includeExited): array
    {
        $rows = DB::table('users as u')
            ->leftJoin('employees as e', fn ($join) => $join->on('e.user_id', '=', 'u.id')->where('e.is_active', 1))
            ->leftJoin('designations as ds', fn ($join) => $join->on('ds.id', '=', 'e.designation_id')->where('ds.is_active', 1))
            ->leftJoin('user_roles as ur', 'ur.user_id', '=', 'u.id')
            ->leftJoin('roles as r', fn ($join) => $join->on('r.id', '=', 'ur.role_id')->where('r.is_active', 1))
            ->where('u.company_id', $companyId)
            ->where('u.is_active', 1)
            ->where('u.is_super_admin', 0)
            ->when(
                ! $includeExited,
                fn ($query) => $query->where(fn ($inner) => $inner
                    ->whereNull('e.employment_status')
                    ->orWhere('e.employment_status', '!=', Employee::EMPLOYMENT_EXITED))
            )
            ->orderByRaw('COALESCE(r.hierarchy_level, 99)')
            ->orderBy('u.name')
            ->get([
                'u.id', 'u.uuid', 'u.name', 'u.email', 'u.avatar_path',
                'u.branch_id', 'u.department_id', 'u.team_id',
                'e.uuid as employee_uuid', 'e.employee_code', 'e.employment_status', 'e.reporting_manager_id',
                'ds.name as designation', 'r.name as role', 'r.hierarchy_level',
            ]);

        $people = [];

        foreach ($rows as $row) {
            $id = (int) $row->id;

            if (isset($people[$id])) {
                if ($row->role !== null && ! in_array($row->role, $people[$id]['roles'], true)) {
                    $people[$id]['roles'][] = $row->role;
                }

                continue;
            }

            $people[$id] = [
                'user_id' => $id,
                'uuid' => $row->uuid,
                'name' => $row->name,
                'email' => $row->email,
                'avatar_path' => $row->avatar_path,
                'employee_uuid' => $row->employee_uuid,
                'employee_code' => $row->employee_code,
                'designation' => $row->designation,
                'roles' => $row->role === null ? [] : [$row->role],
                'hierarchy_level' => $row->hierarchy_level === null ? null : (int) $row->hierarchy_level,
                'employment_status' => $row->employment_status,
                'reporting_manager_id' => $row->reporting_manager_id === null ? null : (int) $row->reporting_manager_id,
                'branch_id' => (int) ($row->branch_id ?? self::UNASSIGNED),
                'department_id' => (int) ($row->department_id ?? self::UNASSIGNED),
                'team_id' => (int) ($row->team_id ?? self::UNASSIGNED),
            ];
        }

        return array_values($people);
    }
}

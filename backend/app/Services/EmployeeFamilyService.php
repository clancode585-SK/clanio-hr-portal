<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeFamilyMember;
use App\Models\User;
use App\Support\TenantCache;

final class EmployeeFamilyService
{
    public function create(Employee $employee, array $data, User $actor): EmployeeFamilyMember
    {
        $member = new EmployeeFamilyMember($data);
        $member->company_id = $employee->company_id;
        $member->employee_id = $employee->id;
        $member->created_by = $actor->id;

        $this->assertNomineeShare($employee, $member);
        $member->save();

        TenantCache::flush(TenantCache::EMPLOYEES);

        return $member;
    }

    public function update(EmployeeFamilyMember $member, array $data, User $actor): EmployeeFamilyMember
    {
        $member->fill($data);
        $member->updated_by = $actor->id;

        $this->assertNomineeShare($member->employee, $member);
        $member->save();

        TenantCache::flush(TenantCache::EMPLOYEES);

        return $member->refresh();
    }

    public function delete(EmployeeFamilyMember $member): void
    {
        $member->delete();

        TenantCache::flush(TenantCache::EMPLOYEES);
    }

    private function assertNomineeShare(Employee $employee, EmployeeFamilyMember $member): void
    {
        if (! $member->is_nominee) {
            return;
        }

        $existing = (float) $employee->familyMembers()
            ->where('is_nominee', true)
            ->when($member->exists, fn ($query) => $query->whereKeyNot($member->id))
            ->sum('nominee_share');

        if ($existing + (float) $member->nominee_share > 100.0) {
            throw new ApiException(
                'Total nominee share cannot go above 100%. Already allotted: ' . $existing . '%.',
                422,
                'NOMINEE_SHARE_EXCEEDED'
            );
        }
    }
}

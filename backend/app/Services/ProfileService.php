<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Employee;
use App\Models\User;
use App\Support\TenantCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class ProfileService
{
    private const USER_FIELDS = ['name', 'phone'];

    private const EMPLOYEE_FIELDS = [
        'date_of_birth',
        'gender',
        'marital_status',
        'blood_group',
        'personal_email',
        'personal_phone',
        'current_address',
        'permanent_address',
        'emergency_contact_name',
        'emergency_contact_relation',
        'emergency_contact_phone',
        'pan_number',
    ];

    private const AVATAR_DIR = 'avatars';

    public function show(User $user): User
    {
        return $user->load([
            'roles',
            'branch',
            'department',
            'team',
            'employee.designation',
            'employee.workShift',
            'employee.reportingManager',
            'employee.familyMembers',
            'employee.bankAccounts',
            'employee.documents',
        ]);
    }

    public function update(User $user, array $data): User
    {
        return DB::transaction(function () use ($user, $data): User {
            $userData = Arr::only($data, self::USER_FIELDS);

            if ($userData !== []) {
                $user->fill($userData);
                $user->updated_by = $user->id;
                $user->save();
            }

            $employeeData = Arr::only($data, self::EMPLOYEE_FIELDS);
            $employee = $user->employee;

            if ($employeeData !== [] && $employee instanceof Employee) {
                $employee->fill($employeeData);
                $employee->updated_by = $user->id;
                $employee->save();

                TenantCache::flush(TenantCache::EMPLOYEES);
            }

            TenantCache::flush(TenantCache::USERS);

            return $this->show($user->refresh());
        });
    }

    public function updateAvatar(User $user, UploadedFile $file): User
    {
        $this->removeAvatar($user);

        $path = $file->storeAs(
            self::AVATAR_DIR,
            $user->uuid . '.' . strtolower($file->getClientOriginalExtension() ?: 'jpg'),
            'public'
        );

        $user->forceFill(['avatar_path' => $path, 'updated_by' => $user->id])->save();

        TenantCache::flush(TenantCache::USERS);

        return $this->show($user->refresh());
    }

    public function deleteAvatar(User $user): User
    {
        $this->removeAvatar($user);

        $user->forceFill(['avatar_path' => null, 'updated_by' => $user->id])->save();

        TenantCache::flush(TenantCache::USERS);

        return $this->show($user->refresh());
    }

    private function removeAvatar(User $user): void
    {
        if ($user->avatar_path !== null && Storage::disk('public')->exists($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }
    }
}

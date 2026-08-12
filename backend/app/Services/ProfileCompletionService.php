<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\PolicyAcknowledgement;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class ProfileCompletionService
{
    private const WEIGHTS = [
        'personal' => 20,
        'bank' => 15,
        'documents' => 20,
        'family' => 15,
        'policies' => 30,
    ];

    private const PERSONAL_FIELDS = [
        'date_of_birth',
        'gender',
        'personal_phone',
        'current_address',
        'emergency_contact_name',
        'emergency_contact_phone',
        'pan_number',
    ];

    public function forUser(User $actor, ?int $employeeId = null): array
    {
        $employee = $this->employeeFor($actor, $employeeId);

        $sections = [
            $this->personal($employee),
            $this->bank($employee),
            $this->documents($employee),
            $this->family($employee),
            $this->policies($employee),
        ];

        $percent = 0;

        foreach ($sections as $section) {
            $percent += $section['weight'] * $section['percent'] / 100;
        }

        $percent = (int) round($percent);

        return [
            'employee_id' => (int) $employee->id,
            'employee_name' => $employee->user?->name,
            'percent' => $percent,
            'is_complete' => $percent === 100,
            'onboarding_status' => $employee->onboarding_status,
            'sections' => $sections,
            'pending' => array_values(array_map(
                fn (array $section): string => $section['label'],
                array_filter($sections, fn (array $section): bool => $section['percent'] < 100)
            )),
        ];
    }

    private function personal(Employee $employee): array
    {
        $filled = 0;

        foreach (self::PERSONAL_FIELDS as $field) {
            if ($employee->{$field} !== null && $employee->{$field} !== '') {
                $filled++;
            }
        }

        $total = count(self::PERSONAL_FIELDS);

        return $this->section('personal', 'Personal details', $filled, $total);
    }

    private function bank(Employee $employee): array
    {
        $has = DB::table('employee_bank_accounts')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->exists();

        return $this->section('bank', 'Bank account', $has ? 1 : 0, 1);
    }

    private function documents(Employee $employee): array
    {
        $uploaded = DB::table('employee_documents')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->whereIn('type', EmployeeDocument::REQUIRED_FOR_ONBOARDING)
            ->distinct()
            ->count('type');

        $required = count(EmployeeDocument::REQUIRED_FOR_ONBOARDING);

        return $this->section('documents', 'Documents', $uploaded, $required);
    }

    private function family(Employee $employee): array
    {
        $has = DB::table('employee_family_members')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->exists();

        return $this->section('family', 'Family / nominee', $has ? 1 : 0, 1);
    }

    private function policies(Employee $employee): array
    {
        $row = DB::table('policy_acknowledgements')
            ->where('employee_id', $employee->id)
            ->where('is_active', 1)
            ->selectRaw("COUNT(*) as total, SUM(status = '" . PolicyAcknowledgement::ACKNOWLEDGED . "') as done")
            ->first();

        $total = (int) ($row->total ?? 0);
        $done = (int) ($row->done ?? 0);

        return $this->section('policies', 'Policies accepted', $done, $total);
    }

    private function section(string $key, string $label, int $done, int $total): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'weight' => self::WEIGHTS[$key],
            'done' => $done,
            'total' => $total,
            'percent' => $total === 0 ? 100 : (int) round(min($done, $total) / $total * 100),
        ];
    }

    private function employeeFor(User $actor, ?int $employeeId): Employee
    {
        $query = Employee::query()->with('user');

        if ($employeeId === null) {
            $employee = $query->where('user_id', $actor->id)->first();

            if ($employee === null) {
                throw new ApiException(
                    'Profile completion ke liye employee record chahiye.',
                    422,
                    'EMPLOYEE_RECORD_MISSING'
                );
            }

            return $employee;
        }

        $employee = $query->visibleTo($actor)->whereKey($employeeId)->first();

        if ($employee === null) {
            throw new ApiException('Employee not found.', 404, 'NOT_FOUND');
        }

        return $employee;
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Employee;
use App\Models\EmployeeDocument;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class ProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $employee = $this->employee;

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatar_url' => $this->avatarUrl(),
            'status' => $this->status,
            'is_super_admin' => $this->is_super_admin,
            'last_login_at' => $this->last_login_at,

            'roles' => RoleResource::collection($this->whenLoaded('roles')),

            'organisation' => [
                'company_id' => $this->company_id,
                'branch' => new BranchResource($this->whenLoaded('branch')),
                'department' => new DepartmentResource($this->whenLoaded('department')),
                'team' => new TeamResource($this->whenLoaded('team')),
            ],

            'employee' => $employee === null ? null : [
                'id' => $employee->id,
                'employee_code' => $employee->employee_code,
                'date_of_joining' => $employee->date_of_joining?->format('Y-m-d'),
                'employment_type' => $employee->employment_type,
                'probation_end_date' => $employee->probation_end_date?->format('Y-m-d'),
                'confirmation_date' => $employee->confirmation_date?->format('Y-m-d'),

                'date_of_birth' => $employee->date_of_birth?->format('Y-m-d'),
                'gender' => $employee->gender,
                'marital_status' => $employee->marital_status,
                'blood_group' => $employee->blood_group,
                'personal_email' => $employee->personal_email,
                'personal_phone' => $employee->personal_phone,
                'current_address' => $employee->current_address,
                'permanent_address' => $employee->permanent_address,
                'emergency_contact_name' => $employee->emergency_contact_name,
                'emergency_contact_relation' => $employee->emergency_contact_relation,
                'emergency_contact_phone' => $employee->emergency_contact_phone,
                'pan_number' => $employee->pan_number,

                'designation' => $this->one(DesignationResource::class, $employee->designation),
                'work_shift' => $this->one(WorkShiftResource::class, $employee->workShift),
                'reporting_manager' => $this->one(UserResource::class, $employee->reportingManager),
            ],

            'onboarding' => $this->onboarding($employee),

            'family_members' => EmployeeFamilyMemberResource::collection($employee?->familyMembers ?? new Collection()),
            'bank_accounts' => EmployeeBankAccountResource::collection($employee?->bankAccounts ?? new Collection()),
            'documents' => EmployeeDocumentResource::collection($employee?->documents ?? new Collection()),

            'editable_fields' => [
                'name', 'phone', 'date_of_birth', 'gender', 'marital_status', 'blood_group',
                'personal_email', 'personal_phone', 'current_address', 'permanent_address',
                'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone', 'pan_number',
            ],
        ];
    }

    private function one(string $resource, ?Model $model): ?JsonResource
    {
        return $model === null ? null : new $resource($model);
    }

    private function onboarding(?Employee $employee): ?array
    {
        if ($employee === null) {
            return null;
        }

        $documents = $employee->relationLoaded('documents')
            ? $employee->documents
            : new Collection();

        $uploaded = $documents->pluck('type')->unique()->all();
        $missing = array_values(array_diff(EmployeeDocument::REQUIRED_FOR_ONBOARDING, $uploaded));

        $steps = [
            'personal' => $employee->date_of_birth !== null && $employee->current_address !== null,
            'family' => $employee->relationLoaded('familyMembers') && $employee->familyMembers->isNotEmpty(),
            'bank' => $employee->relationLoaded('bankAccounts') && $employee->bankAccounts->isNotEmpty(),
            'documents' => $missing === [],
        ];

        $done = count(array_filter($steps));

        return [
            'status' => $employee->onboarding_status,
            'percent' => (int) round($done / count($steps) * 100),
            'steps' => $steps,
            'required_documents' => EmployeeDocument::REQUIRED_FOR_ONBOARDING,
            'missing_documents' => $missing,
        ];
    }
}

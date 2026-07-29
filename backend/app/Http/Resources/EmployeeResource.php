<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,
            'user_id' => $this->user_id,
            'employee_code' => $this->employee_code,

            'date_of_joining' => $this->date_of_joining?->format('Y-m-d'),
            'employment_type' => $this->employment_type,
            'probation_end_date' => $this->probation_end_date?->format('Y-m-d'),
            'confirmation_date' => $this->confirmation_date?->format('Y-m-d'),

            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'gender' => $this->gender,
            'marital_status' => $this->marital_status,
            'blood_group' => $this->blood_group,
            'personal_email' => $this->personal_email,
            'personal_phone' => $this->personal_phone,
            'current_address' => $this->current_address,
            'permanent_address' => $this->permanent_address,

            'emergency_contact_name' => $this->emergency_contact_name,
            'emergency_contact_relation' => $this->emergency_contact_relation,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'pan_number' => $this->pan_number,

            'designation_id' => $this->designation_id,
            'work_shift_id' => $this->work_shift_id,
            'reporting_manager_id' => $this->reporting_manager_id,

            'onboarding' => [
                'status' => $this->onboarding_status,
                'steps' => [
                    'personal' => true,
                    'family' => $this->whenCounted('familyMembers', fn (int $count): bool => $count > 0),
                    'bank' => $this->whenCounted('bankAccounts', fn (int $count): bool => $count > 0),
                    'documents' => $this->whenCounted('documents', fn (int $count): bool => $count > 0),
                ],
            ],

            'user' => new UserResource($this->whenLoaded('user')),
            'designation' => new DesignationResource($this->whenLoaded('designation')),
            'work_shift' => new WorkShiftResource($this->whenLoaded('workShift')),
            'reporting_manager' => new UserResource($this->whenLoaded('reportingManager')),
            'family_members' => EmployeeFamilyMemberResource::collection($this->whenLoaded('familyMembers')),
            'bank_accounts' => EmployeeBankAccountResource::collection($this->whenLoaded('bankAccounts')),
            'documents' => EmployeeDocumentResource::collection($this->whenLoaded('documents')),

            'created_at' => $this->created_at,
        ];
    }
}

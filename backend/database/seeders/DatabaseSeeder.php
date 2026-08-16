<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $company = Company::firstOrCreate(
            ['slug' => 'acme-technologies'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Acme Technologies Pvt Ltd',
                'legal_name' => 'Acme Technologies Private Limited',
                'email' => 'contact@acme.com',
                'status' => 'active',
            ]
        );

        app(\App\Support\TenantContext::class)->set($company);

        User::withoutGlobalScopes()->firstOrCreate(
            ['email' => 'superadmin@clanio.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Platform Super Admin',
                'password' => Hash::make('password123'),
                'is_super_admin' => true,
                'status' => 'active',
            ]
        );

        $branch = Branch::firstOrCreate(
            ['company_id' => $company->id, 'code' => 'HQ'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Head Office (Mumbai)',
                'is_head_office' => true,
                'status' => 'active',
            ]
        );

        $deptEng = Department::firstOrCreate(
            ['company_id' => $company->id, 'code' => 'ENG'],
            ['uuid' => (string) Str::uuid(), 'branch_id' => $branch->id, 'name' => 'Engineering']
        );
        $deptHr = Department::firstOrCreate(
            ['company_id' => $company->id, 'code' => 'HR'],
            ['uuid' => (string) Str::uuid(), 'branch_id' => $branch->id, 'name' => 'Human Resources']
        );
        $deptMkt = Department::firstOrCreate(
            ['company_id' => $company->id, 'code' => 'MKT'],
            ['uuid' => (string) Str::uuid(), 'branch_id' => $branch->id, 'name' => 'Marketing']
        );

        $desig1 = Designation::firstOrCreate(
            ['company_id' => $company->id, 'code' => 'SR_ENG'],
            ['uuid' => (string) Str::uuid(), 'name' => 'Senior Full Stack Engineer']
        );
        $desig2 = Designation::firstOrCreate(
            ['company_id' => $company->id, 'code' => 'HR_LEAD'],
            ['uuid' => (string) Str::uuid(), 'name' => 'HR Lead']
        );
        $desig3 = Designation::firstOrCreate(
            ['company_id' => $company->id, 'code' => 'MKT_STRAT'],
            ['uuid' => (string) Str::uuid(), 'name' => 'Growth Strategist']
        );
        $desig4 = Designation::firstOrCreate(
            ['company_id' => $company->id, 'code' => 'FE_DEV'],
            ['uuid' => (string) Str::uuid(), 'name' => 'Frontend Developer']
        );

        $employeesData = [
            [
                'name' => 'Rahul Sharma',
                'email' => 'rahul.sharma@clanoid.com',
                'code' => 'EMP-001',
                'designation' => $desig1->id,
                'status' => 'completed',
            ],
            [
                'name' => 'Priya Patel',
                'email' => 'priya.patel@clanoid.com',
                'code' => 'EMP-002',
                'designation' => $desig2->id,
                'status' => 'completed',
            ],
            [
                'name' => 'Amit Verma',
                'email' => 'amit.v@clanoid.com',
                'code' => 'EMP-003',
                'designation' => $desig3->id,
                'status' => 'completed',
            ],
            [
                'name' => 'Sneha Reddy',
                'email' => 'sneha.r@clanoid.com',
                'code' => 'EMP-004',
                'designation' => $desig4->id,
                'status' => 'completed',
            ],
            [
                'name' => 'Vikram Mehta',
                'email' => 'vikram.m@clanoid.com',
                'code' => 'EMP-005',
                'designation' => $desig1->id,
                'status' => 'completed',
            ],
        ];

        foreach ($employeesData as $emp) {
            $user = User::firstOrCreate(
                ['email' => $emp['email']],
                [
                    'uuid' => (string) Str::uuid(),
                    'company_id' => $company->id,
                    'name' => $emp['name'],
                    'password' => Hash::make('password123'),
                    'status' => 'active',
                ]
            );

            Employee::firstOrCreate(
                ['company_id' => $company->id, 'user_id' => $user->id],
                [
                    'uuid' => (string) Str::uuid(),
                    'employee_code' => $emp['code'],
                    'designation_id' => $emp['designation'],
                    'date_of_joining' => now()->subMonths(6)->format('Y-m-d'),
                    'personal_email' => $emp['email'],
                    'onboarding_status' => $emp['status'],
                ]
            );
        }
    }
}

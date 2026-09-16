<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Employee;
use App\Models\SalaryComponent;
use App\Models\SalaryStructure;
use App\Models\SalaryStructureLine;
use App\Models\User;
use App\Support\CompanyTime;
use App\Support\SalaryMath;
use App\Support\TenantCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SalaryStructureService
{
    public function standardComponents(int $companyId, User $actor): array
    {
        $existing = SalaryComponent::query()
            ->where('company_id', $companyId)
            ->pluck('code')
            ->all();

        $made = 0;

        foreach (SalaryComponent::STANDARD as $row) {
            if (in_array($row['code'], $existing, true)) {
                continue;
            }

            $component = new SalaryComponent($row);
            $component->company_id = $companyId;
            $component->created_by = $actor->id;
            $component->save();

            $made++;
        }

        $this->flush();

        return [
            'created' => $made,
            'skipped' => count(SalaryComponent::STANDARD) - $made,
        ];
    }

    public function createComponent(int $companyId, array $data, User $actor): SalaryComponent
    {
        $this->assertBalanceIsAlone($companyId, $data, null);

        $component = new SalaryComponent($data);
        $component->company_id = $companyId;
        $component->created_by = $actor->id;
        $component->save();

        $this->flush();

        return $component;
    }

    public function updateComponent(SalaryComponent $component, array $data, User $actor): SalaryComponent
    {
        $this->assertBalanceIsAlone((int) $component->company_id, $data, (int) $component->id);

        $component->fill($data);
        $component->updated_by = $actor->id;
        $component->save();

        $this->flush();

        return $component->refresh();
    }

    public function deleteComponent(SalaryComponent $component): void
    {
        $used = SalaryStructureLine::query()->where('component_id', $component->id)->exists();

        if ($used) {
            throw new ApiException(
                'Ye component kisi salary structure me laga hua hai. Pehle wahan se hatao.',
                409,
                'COMPONENT_IN_USE'
            );
        }

        $component->deactivate();
        $this->flush();
    }

    public function preview(int $companyId, array $data): array
    {
        [$lines] = $this->compose($companyId, $data, null);

        return [
            'lines' => $lines,
            'totals' => SalaryMath::totals($lines),
            'settings' => SalaryMath::settings($companyId),
        ];
    }

    public function save(Employee $employee, array $data, User $actor): SalaryStructure
    {
        $companyId = (int) $employee->company_id;
        $from = Carbon::parse($data['effective_from'])->startOfDay();

        [$lines, $totals] = $this->compose($companyId, $data, $employee);

        return DB::transaction(function () use ($employee, $companyId, $from, $data, $lines, $totals, $actor): SalaryStructure {
            $this->closeRunning($employee, $from, $actor);

            $structure = new SalaryStructure([
                'effective_from' => $from->toDateString(),
                'annual_ctc' => (float) $data['annual_ctc'],
                'revision_reason' => $data['revision_reason'] ?? null,
            ]);

            $structure->company_id = $companyId;
            $structure->employee_id = $employee->id;
            $structure->monthly_gross = $totals['monthly_gross'];
            $structure->monthly_net = $totals['monthly_net'];
            $structure->created_by = $actor->id;
            $structure->save();

            foreach ($lines as $line) {
                $row = new SalaryStructureLine($line);
                $row->company_id = $companyId;
                $row->structure_id = $structure->id;
                $row->save();
            }

            $this->flush();

            return $structure->refresh()->load('lines', 'employee.user');
        });
    }

    public function forMonth(Employee $employee, string $month): ?SalaryStructure
    {
        return SalaryStructure::query()
            ->with('lines')
            ->where('employee_id', $employee->id)
            ->effectiveOn($month . '-01')
            ->orderByDesc('effective_from')
            ->first();
    }

    public function history(Employee $employee): array
    {
        return SalaryStructure::query()
            ->with('lines')
            ->where('employee_id', $employee->id)
            ->orderByDesc('effective_from')
            ->get()
            ->all();
    }

    public function coverage(int $companyId, string $month): array
    {
        $employees = Employee::query()
            ->where('company_id', $companyId)
            ->where('employment_status', Employee::EMPLOYMENT_ACTIVE)
            ->with('user:id,name')
            ->get(['id', 'company_id', 'employee_code', 'user_id']);

        $withStructure = SalaryStructure::query()
            ->where('company_id', $companyId)
            ->effectiveOn($month . '-01')
            ->pluck('employee_id')
            ->unique()
            ->all();

        $missing = $employees
            ->reject(fn (Employee $employee): bool => in_array($employee->id, $withStructure, true))
            ->map(fn (Employee $employee): array => [
                'employee_id' => (int) $employee->id,
                'employee_code' => $employee->employee_code,
                'name' => $employee->user?->name,
            ])
            ->values()
            ->all();

        return [
            'month' => $month,
            'headcount' => $employees->count(),
            'ready' => $employees->count() - count($missing),
            'missing' => $missing,
        ];
    }

    private function compose(int $companyId, array $data, ?Employee $employee): array
    {
        $components = SalaryComponent::query()
            ->where('company_id', $companyId)
            ->orderBy('sequence')
            ->get()
            ->keyBy('id');

        if ($components->isEmpty()) {
            throw new ApiException(
                'Pehle salary components bana lo. Company Settings me "standard setup" se ek click me ban jaate hain.',
                422,
                'NO_SALARY_COMPONENTS'
            );
        }

        $picked = [];

        foreach ($data['lines'] ?? [] as $row) {
            $component = $components->get((int) ($row['component_id'] ?? 0));

            if ($component === null) {
                throw new ApiException(
                    'Component #' . ($row['component_id'] ?? '?') . ' is company me nahi hai.',
                    422,
                    'COMPONENT_NOT_FOUND'
                );
            }

            $picked[] = [
                'component' => $component,
                'value' => (float) ($row['value'] ?? $component->default_value),
            ];
        }

        if ($picked === []) {
            foreach ($components as $component) {
                $picked[] = ['component' => $component, 'value' => (float) $component->default_value];
            }
        }

        $this->assertHasBasic($picked);

        $hasPf = $employee === null
            ? (bool) ($data['has_pf_account'] ?? true)
            : (bool) $employee->has_pf_account;

        $lines = SalaryMath::build(
            (float) $data['annual_ctc'],
            $picked,
            SalaryMath::settings($companyId),
            $hasPf
        );

        return [$lines, SalaryMath::totals($lines)];
    }

    private function closeRunning(Employee $employee, Carbon $from, User $actor): void
    {
        $running = SalaryStructure::query()
            ->where('employee_id', $employee->id)
            ->whereNull('effective_to')
            ->where('status', SalaryStructure::ACTIVE)
            ->get();

        foreach ($running as $structure) {
            if ($structure->effective_from->greaterThanOrEqualTo($from)) {
                throw new ApiException(
                    'Is employee ka ' . $structure->effective_from->format('d M Y')
                        . ' se structure already chal raha hai. Naya structure usse aage ki date se banao.',
                    409,
                    'STRUCTURE_DATE_OVERLAP'
                );
            }

            $structure->forceFill([
                'effective_to' => $from->copy()->subDay()->toDateString(),
                'status' => SalaryStructure::SUPERSEDED,
                'updated_by' => $actor->id,
            ])->save();
        }
    }

    private function assertHasBasic(array $picked): void
    {
        foreach ($picked as $row) {
            if ($row['component']->code === SalaryComponent::BASIC) {
                return;
            }
        }

        throw new ApiException('Structure me Basic hona zaroori hai — PF isi par nikalta hai.', 422, 'BASIC_MISSING');
    }

    private function assertBalanceIsAlone(int $companyId, array $data, ?int $ignoreId): void
    {
        if (($data['calculation'] ?? null) !== SalaryComponent::BALANCE) {
            return;
        }

        $exists = SalaryComponent::query()
            ->where('company_id', $companyId)
            ->where('calculation', SalaryComponent::BALANCE)
            ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();

        if ($exists) {
            throw new ApiException(
                'Ek hi component "balance" ho sakta hai — warna bacha hua paisa do jagah chala jayega.',
                422,
                'BALANCE_ALREADY_SET'
            );
        }
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::EMPLOYEES);
    }
}

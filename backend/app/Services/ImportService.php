<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Asset;
use App\Models\Attendance;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkShift;
use App\Support\ImportModules;
use App\Support\TenantCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Throwable;

final class ImportService
{
    private const MAX_ROWS = 2000;

    private const DEFAULT_PASSWORD = 'Welcome@123';

    public function __construct(private readonly EmployeeService $employees) {}

    public function run(string $module, UploadedFile $file, User $actor, int $companyId): array
    {
        $definition = ImportModules::find($module);

        if ($definition === null) {
            throw new \App\Exceptions\ApiException('That module cannot be imported.', 422, 'IMPORT_MODULE_UNKNOWN');
        }

        $rows = $this->readCsv($file, array_keys($definition['columns']));

        if ($rows === []) {
            throw new \App\Exceptions\ApiException(
                'The file has no data rows. Keep the header row and add one record per line.',
                422,
                'IMPORT_EMPTY'
            );
        }

        $created = 0;
        $updated = 0;
        $failures = [];

        foreach ($rows as $index => $row) {
            try {
                $outcome = $this->importRow($module, $definition, $row, $actor, $companyId);

                $outcome['outcome'] === 'created' ? $created++ : $updated++;
            } catch (Throwable $exception) {
                $failures[] = [
                    'row' => $index + 2,
                    'reference' => Str::limit((string) ($row['name'] ?? $row['email'] ?? $row['code'] ?? ''), 60, ''),
                    'message' => Str::limit($this->readable($exception), 200, ''),
                ];
            }
        }

        TenantCache::flush(TenantCache::EMPLOYEES);

        return [
            'module' => $module,
            'file' => (string) $file->getClientOriginalName(),
            'total' => count($rows),
            'created' => $created,
            'updated' => $updated,
            'failed' => count($failures),
            'failures' => array_slice($failures, 0, 100),
        ];
    }

    private function importRow(string $module, array $definition, array $row, User $actor, int $companyId): array
    {
        $this->validateRow($definition, $row);

        return match ($module) {
            'departments' => $this->simple(Department::class, $row, $companyId, $actor, ['name', 'code', 'description']),
            'designations' => $this->designation($row, $companyId, $actor),
            'branches' => $this->simple(Branch::class, $row, $companyId, $actor, ['name', 'code', 'address', 'city', 'phone', 'email']),
            'work_shifts' => $this->workShift($row, $companyId, $actor),
            'leave_types' => $this->leaveType($row, $companyId, $actor),
            'holidays' => $this->holiday($row, $companyId, $actor),
            'teams' => $this->team($row, $companyId, $actor),
            'employees' => $this->employee($row, $companyId, $actor),
            'leave_balances' => $this->leaveBalance($row, $companyId, $actor),
            'attendance' => $this->attendance($row, $companyId, $actor),
            'assets' => $this->asset($row, $companyId, $actor),
            default => throw new \RuntimeException('This module is not supported yet'),
        };
    }

    private function validateRow(array $definition, array $row): void
    {
        $rules = [];
        $values = [];

        foreach ($definition['columns'] as $column => $spec) {
            $value = $row[$column] ?? null;
            $required = (bool) ($spec['required'] ?? false);

            if ($required && $this->blank($value)) {
                throw new \RuntimeException($column . ' is required');
            }

            if ($this->blank($value)) {
                continue;
            }

            $values[$column] = trim((string) $value);

            if (isset($spec['rule'])) {
                $rules[$column] = explode('|', (string) $spec['rule']);
            }
        }

        if ($rules === []) {
            return;
        }

        $validator = Validator::make($values, $rules);

        if ($validator->fails()) {
            throw new \RuntimeException(implode(' ', $validator->errors()->all()));
        }
    }

    private function simple(string $model, array $row, int $companyId, User $actor, array $fields): array
    {
        $code = $this->text($row['code'] ?? null);

        $record = $model::query()
            ->where('company_id', $companyId)
            ->where('code', $code)
            ->first();

        $existed = $record !== null;
        $record ??= new $model();
        $record->company_id = $companyId;

        foreach ($fields as $field) {
            if (! $this->blank($row[$field] ?? null)) {
                $record->{$field} = $this->text($row[$field]);
            }
        }

        $record->is_active = 1;
        $existed ? $record->updated_by = $actor->id : $record->created_by = $actor->id;
        $record->save();

        return ['outcome' => $existed ? 'updated' : 'created', 'reference' => $record->name ?? $code];
    }

    private function designation(array $row, int $companyId, User $actor): array
    {
        $result = $this->simple(Designation::class, $row, $companyId, $actor, ['name', 'code']);

        if (! $this->blank($row['level'] ?? null)) {
            Designation::query()
                ->where('company_id', $companyId)
                ->where('code', $this->text($row['code']))
                ->update(['level' => (int) $row['level']]);
        }

        return $result;
    }

    private function workShift(array $row, int $companyId, User $actor): array
    {
        $code = $this->text($row['code']);

        $shift = WorkShift::query()->where('company_id', $companyId)->where('code', $code)->first();
        $existed = $shift !== null;
        $shift ??= new WorkShift();

        $offs = array_values(array_filter(
            array_map(
                static fn (string $part): int => (int) trim($part),
                explode(',', (string) ($row['weekly_offs'] ?? ''))
            ),
            static fn (int $day): bool => $day >= 0 && $day <= 6
        ));

        $shift->company_id = $companyId;
        $shift->name = $this->text($row['name']);
        $shift->code = $code;
        $shift->start_time = $this->time($row['start_time']);
        $shift->end_time = $this->time($row['end_time']);
        $shift->weekly_offs = $offs === [] ? [0] : $offs;

        if (! $this->blank($row['grace_minutes'] ?? null)) {
            $shift->grace_minutes = (int) $row['grace_minutes'];
        }

        $shift->is_active = 1;
        $existed ? $shift->updated_by = $actor->id : $shift->created_by = $actor->id;
        $shift->save();

        return ['outcome' => $existed ? 'updated' : 'created', 'reference' => $shift->name];
    }

    private function leaveType(array $row, int $companyId, User $actor): array
    {
        $code = strtoupper($this->text($row['code']));

        $type = LeaveType::query()->where('company_id', $companyId)->where('code', $code)->first();
        $existed = $type !== null;
        $type ??= new LeaveType();

        $type->company_id = $companyId;
        $type->name = $this->text($row['name']);
        $type->code = $code;

        if (! $this->blank($row['annual_quota'] ?? null)) {
            $type->annual_quota = (float) $row['annual_quota'];
        }

        if (! $this->blank($row['accrual_type'] ?? null)) {
            $type->accrual_type = strtolower($this->text($row['accrual_type'])) === 'monthly' ? 'monthly' : 'yearly';
        }

        if (! $this->blank($row['is_paid'] ?? null)) {
            $type->is_paid = $this->boolean($row['is_paid']);
        }

        $type->is_active = 1;
        $existed ? $type->updated_by = $actor->id : $type->created_by = $actor->id;
        $type->save();

        return ['outcome' => $existed ? 'updated' : 'created', 'reference' => $type->name];
    }

    private function holiday(array $row, int $companyId, User $actor): array
    {
        $date = $this->date($row['holiday_date']);

        $holiday = Holiday::query()
            ->where('company_id', $companyId)
            ->whereNull('branch_id')
            ->whereDate('holiday_date', $date)
            ->first();

        $existed = $holiday !== null;
        $holiday ??= new Holiday();

        $holiday->company_id = $companyId;
        $holiday->name = $this->text($row['name']);
        $holiday->holiday_date = $date;

        if (! $this->blank($row['type'] ?? null)) {
            $type = strtolower($this->text($row['type']));
            $holiday->type = in_array($type, ['public', 'optional', 'restricted'], true) ? $type : 'public';
        }

        if (! $this->blank($row['is_paid'] ?? null)) {
            $holiday->is_paid = $this->boolean($row['is_paid']);
        }

        $holiday->is_active = 1;
        $existed ? $holiday->updated_by = $actor->id : $holiday->created_by = $actor->id;
        $holiday->save();

        return ['outcome' => $existed ? 'updated' : 'created', 'reference' => $holiday->name];
    }

    private function team(array $row, int $companyId, User $actor): array
    {
        $department = $this->lookup(Department::class, $companyId, 'code', $row['department_code'], 'Department');
        $code = $this->text($row['code']);

        $team = Team::query()
            ->where('company_id', $companyId)
            ->where('department_id', $department->id)
            ->where('code', $code)
            ->first();

        $existed = $team !== null;
        $team ??= new Team();

        $team->company_id = $companyId;
        $team->department_id = $department->id;
        $team->name = $this->text($row['name']);
        $team->code = $code;

        if (! $this->blank($row['description'] ?? null)) {
            $team->description = $this->text($row['description']);
        }

        $team->is_active = 1;
        $existed ? $team->updated_by = $actor->id : $team->created_by = $actor->id;
        $team->save();

        return ['outcome' => $existed ? 'updated' : 'created', 'reference' => $team->name];
    }

    private function employee(array $row, int $companyId, User $actor): array
    {
        $email = strtolower($this->text($row['email']));
        $role = $this->lookup(Role::class, $companyId, 'slug', $row['role_slug'], 'Role', true);

        $existing = User::query()
            ->where('company_id', $companyId)
            ->where('email', $email)
            ->first();

        $links = [
            'department_id' => $this->optionalId(Department::class, $companyId, 'code', $row['department_code'] ?? null),
            'team_id' => $this->optionalId(Team::class, $companyId, 'code', $row['team_code'] ?? null),
            'branch_id' => $this->optionalId(Branch::class, $companyId, 'code', $row['branch_code'] ?? null),
        ];

        $designationId = $this->optionalId(Designation::class, $companyId, 'code', $row['designation_code'] ?? null);
        $shiftId = $this->optionalId(WorkShift::class, $companyId, 'code', $row['shift_code'] ?? null);
        $managerId = null;

        if (! $this->blank($row['manager_email'] ?? null)) {
            $manager = User::query()
                ->where('company_id', $companyId)
                ->where('email', strtolower($this->text($row['manager_email'])))
                ->first();

            if ($manager === null) {
                throw new \RuntimeException('Manager ' . $row['manager_email'] . ' was not found');
            }

            $managerId = $manager->id;
        }

        $employeeFields = array_filter([
            'designation_id' => $designationId,
            'work_shift_id' => $shiftId,
            'reporting_manager_id' => $managerId,
            'date_of_joining' => $this->date($row['date_of_joining']),
            'employment_type' => $this->blank($row['employment_type'] ?? null)
                ? 'full_time'
                : strtolower($this->text($row['employment_type'])),
            'gender' => $this->blank($row['gender'] ?? null) ? null : strtolower($this->text($row['gender'])),
            'date_of_birth' => $this->blank($row['date_of_birth'] ?? null) ? null : $this->date($row['date_of_birth']),
        ], static fn ($value): bool => $value !== null);

        if ($existing !== null) {
            $employee = Employee::query()->where('user_id', $existing->id)->first();

            if ($employee === null) {
                throw new \RuntimeException('A user with this email exists but has no employee record');
            }

            $existing->fill(array_filter($links, static fn ($value): bool => $value !== null));
            $existing->name = $this->text($row['name']);

            if (! $this->blank($row['phone'] ?? null)) {
                $existing->phone = $this->text($row['phone']);
            }

            $existing->updated_by = $actor->id;
            $existing->save();
            $existing->roles()->syncWithoutDetaching([$role->id]);

            $this->employees->update($employee, $employeeFields, $actor);

            return ['outcome' => 'updated', 'reference' => $existing->name];
        }

        $employee = $this->employees->create([
            'user' => array_merge([
                'name' => $this->text($row['name']),
                'email' => $email,
                'password' => $this->blank($row['password'] ?? null)
                    ? self::DEFAULT_PASSWORD
                    : (string) $row['password'],
                'role_ids' => [$role->id],
            ], array_filter($links, static fn ($value): bool => $value !== null),
                $this->blank($row['phone'] ?? null) ? [] : ['phone' => $this->text($row['phone'])]),
        ] + $employeeFields, $actor, $companyId);

        return ['outcome' => 'created', 'reference' => $employee->user?->name ?? $email];
    }

    private function leaveBalance(array $row, int $companyId, User $actor): array
    {
        $employee = $this->employeeByEmail($row['employee_email'], $companyId);
        $type = $this->lookup(LeaveType::class, $companyId, 'code', strtoupper($this->text($row['leave_code'])), 'Leave type');
        $year = (int) $row['year'];

        $balance = LeaveBalance::query()
            ->where('company_id', $companyId)
            ->where('employee_id', $employee->id)
            ->where('leave_type_id', $type->id)
            ->where('year', $year)
            ->first();

        $existed = $balance !== null;
        $balance ??= new LeaveBalance();

        $balance->company_id = $companyId;
        $balance->employee_id = $employee->id;
        $balance->leave_type_id = $type->id;
        $balance->year = $year;

        if (! $this->blank($row['opening'] ?? null)) {
            $balance->opening = (float) $row['opening'];
        }

        if (! $this->blank($row['used'] ?? null)) {
            $balance->used = (float) $row['used'];
        }

        $balance->is_active = 1;
        $existed ? $balance->updated_by = $actor->id : $balance->created_by = $actor->id;
        $balance->save();

        return ['outcome' => $existed ? 'updated' : 'created', 'reference' => $employee->employee_code . ' ' . $type->code];
    }

    private function attendance(array $row, int $companyId, User $actor): array
    {
        $employee = $this->employeeByEmail($row['employee_email'], $companyId);
        $date = $this->date($row['attendance_date']);

        $record = Attendance::query()
            ->where('company_id', $companyId)
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', $date)
            ->first();

        $existed = $record !== null;
        $record ??= new Attendance();

        $record->company_id = $companyId;
        $record->employee_id = $employee->id;
        $record->attendance_date = $date;

        if (! $this->blank($row['check_in'] ?? null)) {
            $record->first_check_in_at = $date . ' ' . $this->time($row['check_in']) . ':00';
        }

        if (! $this->blank($row['check_out'] ?? null)) {
            $record->last_check_out_at = $date . ' ' . $this->time($row['check_out']) . ':00';
        }

        if (! $this->blank($row['status'] ?? null)) {
            $record->status = strtolower($this->text($row['status']));
        }

        $record->is_active = 1;
        $existed ? $record->updated_by = $actor->id : $record->created_by = $actor->id;
        $record->save();

        return ['outcome' => $existed ? 'updated' : 'created', 'reference' => $employee->employee_code . ' ' . $date];
    }

    private function asset(array $row, int $companyId, User $actor): array
    {
        $code = $this->blank($row['asset_code'] ?? null) ? null : $this->text($row['asset_code']);

        $asset = $code === null
            ? null
            : Asset::query()->where('company_id', $companyId)->where('asset_code', $code)->first();

        $existed = $asset !== null;
        $asset ??= new Asset();

        $asset->company_id = $companyId;
        $asset->name = $this->text($row['name']);
        $asset->category = strtolower($this->text($row['category']));

        if ($code !== null) {
            $asset->asset_code = $code;
        }

        foreach (['brand', 'model', 'serial_number'] as $field) {
            if (! $this->blank($row[$field] ?? null)) {
                $asset->{$field} = $this->text($row[$field]);
            }
        }

        if (! $this->blank($row['purchase_date'] ?? null)) {
            $asset->purchase_date = $this->date($row['purchase_date']);
        }

        if (! $this->blank($row['purchase_cost'] ?? null)) {
            $asset->purchase_cost = (float) $row['purchase_cost'];
        }

        if (! $this->blank($row['holder_email'] ?? null)) {
            $holder = $this->employeeByEmail($row['holder_email'], $companyId);
            $asset->current_employee_id = $holder->id;
            $asset->status = 'allocated';
        }

        $asset->is_active = 1;
        $existed ? $asset->updated_by = $actor->id : $asset->created_by = $actor->id;
        $asset->save();

        return ['outcome' => $existed ? 'updated' : 'created', 'reference' => $asset->name];
    }

    private function employeeByEmail(mixed $email, int $companyId): Employee
    {
        $user = User::query()
            ->where('company_id', $companyId)
            ->where('email', strtolower($this->text($email)))
            ->first();

        $employee = $user === null
            ? null
            : Employee::query()->where('company_id', $companyId)->where('user_id', $user->id)->first();

        if ($employee === null) {
            throw new \RuntimeException('Employee ' . $email . ' was not found');
        }

        return $employee;
    }

    private function lookup(string $model, int $companyId, string $column, mixed $value, string $label, bool $allowGlobal = false): mixed
    {
        $text = $this->text($value);

        $record = $model::query()
            ->where(static function ($query) use ($companyId, $allowGlobal): void {
                $query->where('company_id', $companyId);

                if ($allowGlobal) {
                    $query->orWhereNull('company_id');
                }
            })
            ->where($column, $text)
            ->first();

        if ($record === null) {
            throw new \RuntimeException($label . ' ' . $text . ' was not found — import it first');
        }

        return $record;
    }

    private function optionalId(string $model, int $companyId, string $column, mixed $value): ?int
    {
        if ($this->blank($value)) {
            return null;
        }

        return (int) $this->lookup($model, $companyId, $column, $value, class_basename($model))->id;
    }

    private function readCsv(UploadedFile $file, array $headers): array
    {
        $handle = fopen($file->getRealPath(), 'r');

        if ($handle === false) {
            throw new \App\Exceptions\ApiException('The file could not be opened.', 422, 'IMPORT_UNREADABLE');
        }

        $first = fgetcsv($handle);

        if ($first === false) {
            fclose($handle);

            return [];
        }

        $first[0] = preg_replace('/^\x{FEFF}/u', '', (string) $first[0]);
        $map = array_map(
            static fn ($column): string => strtolower(trim(str_replace([' ', '-'], '_', (string) $column))),
            $first
        );

        $missing = array_diff($this->requiredHeaders($headers), $map);

        if ($missing !== []) {
            fclose($handle);

            throw new \App\Exceptions\ApiException(
                'These columns are missing from the file: ' . implode(', ', $missing),
                422,
                'IMPORT_HEADERS_MISSING'
            );
        }

        $rows = [];

        while (($line = fgetcsv($handle)) !== false) {
            if (count($rows) >= self::MAX_ROWS) {
                break;
            }

            if ($line === [null] || implode('', array_map('strval', $line)) === '') {
                continue;
            }

            $row = [];

            foreach ($map as $index => $column) {
                $row[$column] = $line[$index] ?? null;
            }

            $rows[] = $row;
        }

        fclose($handle);

        return $rows;
    }

    private function requiredHeaders(array $headers): array
    {
        return $headers;
    }

    private function readable(Throwable $exception): string
    {
        $message = $exception->getMessage();

        if (str_contains($message, 'Duplicate entry')) {
            return 'This record already exists with a different key';
        }

        if (str_contains($message, 'SQLSTATE')) {
            return 'The database rejected this row — check the values';
        }

        return $message;
    }

    private function blank(mixed $value): bool
    {
        return $value === null || trim((string) $value) === '';
    }

    private function text(mixed $value): string
    {
        return trim((string) $value);
    }

    private function boolean(mixed $value): bool
    {
        return in_array(strtolower($this->text($value)), ['1', 'yes', 'y', 'true', 'haan'], true);
    }

    private function date(mixed $value): string
    {
        $text = $this->text($value);
        $stamp = strtotime($text);

        if ($stamp === false) {
            throw new \RuntimeException($text . ' is not a date the importer understands — use YYYY-MM-DD');
        }

        return date('Y-m-d', $stamp);
    }

    private function time(mixed $value): string
    {
        $text = $this->text($value);

        if (! preg_match('/^([01]?\d|2[0-3]):[0-5]\d/', $text)) {
            throw new \RuntimeException($text . ' is not a time — use HH:MM like 09:30');
        }

        return substr(str_pad($text, 5, '0', STR_PAD_LEFT), 0, 5);
    }
}

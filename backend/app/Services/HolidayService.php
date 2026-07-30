<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Holiday;
use App\Models\User;
use App\Support\AttendanceCache;
use App\Support\Realtime;
use App\Support\TenantCache;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class HolidayService
{
    public function create(array $data, User $actor, ?int $companyId): Holiday
    {
        $holiday = new Holiday($data);
        $holiday->company_id = $this->tenant($companyId);
        $holiday->created_by = $actor->id;
        $holiday->save();

        $this->flush();
        $this->broadcast($holiday, 'created');

        return $holiday;
    }

    public function createMany(array $rows, User $actor, ?int $companyId): Collection
    {
        $companyId = $this->tenant($companyId);

        return DB::transaction(function () use ($rows, $actor, $companyId): Collection {
            $holidays = new Collection();

            foreach ($rows as $row) {
                $holiday = new Holiday($row);
                $holiday->company_id = $companyId;
                $holiday->created_by = $actor->id;
                $holiday->save();

                $holidays->push($holiday);
            }

            $this->flush();

            return $holidays;
        });
    }

    public function update(Holiday $holiday, array $data, User $actor): Holiday
    {
        $holiday->fill($data);
        $holiday->updated_by = $actor->id;
        $holiday->save();

        $this->flush();
        $this->broadcast($holiday, 'updated');

        return $holiday->refresh();
    }

    public function delete(Holiday $holiday): void
    {
        $holiday->delete();

        $this->flush();
        $this->broadcast($holiday, 'deleted');
    }

    private function broadcast(Holiday $holiday, string $action): void
    {
        Realtime::toCompany((int) $holiday->company_id, 'holiday.changed', [
            'action' => $action,
            'holiday_id' => (int) $holiday->id,
            'name' => $holiday->name,
            'holiday_date' => $holiday->holiday_date->toDateString(),
            'branch_id' => $holiday->branch_id === null ? null : (int) $holiday->branch_id,
        ]);
    }

    private function tenant(?int $companyId): int
    {
        if ($companyId === null) {
            throw new ApiException(
                'A holiday belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return $companyId;
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::HOLIDAYS);
        AttendanceCache::flushLists();
    }
}

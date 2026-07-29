<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Holiday;
use App\Models\User;
use App\Support\AttendanceCache;
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

        return $holiday->refresh();
    }

    public function delete(Holiday $holiday): void
    {
        $holiday->delete();

        $this->flush();
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

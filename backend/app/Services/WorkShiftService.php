<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Models\WorkShift;
use App\Support\AttendanceCache;
use App\Support\TenantCache;
use Illuminate\Support\Facades\DB;

final class WorkShiftService
{
    public function create(array $data, User $actor, ?int $companyId): WorkShift
    {
        if ($companyId === null) {
            throw new ApiException(
                'A work shift belongs to a company. Send the X-Company-Id header to choose one.',
                422,
                'TENANT_REQUIRED'
            );
        }

        return DB::transaction(function () use ($data, $actor, $companyId): WorkShift {
            $shift = new WorkShift($data);
            $shift->company_id = $companyId;
            $shift->created_by = $actor->id;
            $shift->save();

            $this->syncDefault($shift);
            $this->flush();

            return $shift;
        });
    }

    public function update(WorkShift $shift, array $data, User $actor): WorkShift
    {
        return DB::transaction(function () use ($shift, $data, $actor): WorkShift {
            $shift->fill($data);
            $shift->updated_by = $actor->id;
            $shift->save();

            $this->syncDefault($shift);
            $this->flush();

            return $shift->refresh();
        });
    }

    public function delete(WorkShift $shift): void
    {
        if ($shift->employees()->exists()) {
            throw new ApiException(
                'This shift is assigned to employees. Move them to another shift first.',
                409,
                'WORK_SHIFT_IN_USE'
            );
        }

        $shift->deactivate();

        $this->flush();
    }

    private function syncDefault(WorkShift $shift): void
    {
        if (! $shift->is_default) {
            return;
        }

        WorkShift::query()
            ->where('company_id', $shift->company_id)
            ->whereKeyNot($shift->id)
            ->update(['is_default' => false]);
    }

    private function flush(): void
    {
        TenantCache::flush(TenantCache::WORK_SHIFTS);
        AttendanceCache::flushLists();
    }
}

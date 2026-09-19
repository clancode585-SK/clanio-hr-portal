<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Company;
use App\Models\Employee;
use Illuminate\Support\Facades\DB;

class GeoFence
{
    public const OFF = 'off';

    public const FLAG = 'flag';

    public const BLOCK = 'block';

    public const MODES = [self::OFF, self::FLAG, self::BLOCK];

    private const EARTH_RADIUS_M = 6371000;

    /**
     * Punch office ke daayre me hai ya nahi.
     *
     * @return array{checked: bool, outside: bool, distance: ?int, radius: ?int, branch: ?string, blocked: bool}
     */
    public static function check(Employee $employee, ?float $latitude, ?float $longitude): array
    {
        $blank = ['checked' => false, 'outside' => false, 'distance' => null, 'radius' => null, 'branch' => null, 'blocked' => false];

        $company = Company::query()->withoutGlobalScopes()->find($employee->company_id);
        $mode = $company?->geo_fence_mode ?? self::OFF;

        if ($mode === self::OFF || $employee->geo_fence_exempt) {
            return $blank;
        }

        $branchId = DB::table('users')->where('id', $employee->user_id)->value('branch_id');

        if ($branchId === null) {
            return $blank;
        }

        $branch = DB::table('branches')
            ->where('id', $branchId)
            ->first(['name', 'latitude', 'longitude', 'geo_radius_metres']);

        if ($branch === null || $branch->latitude === null || $branch->longitude === null) {
            return $blank;
        }

        // Location hi nahi aayi to block nahi karte — phone permission de sakta hai mana
        if ($latitude === null || $longitude === null) {
            return $blank;
        }

        $distance = (int) round(self::distance(
            (float) $branch->latitude,
            (float) $branch->longitude,
            $latitude,
            $longitude
        ));

        $radius = (int) $branch->geo_radius_metres;
        $outside = $distance > $radius;

        return [
            'checked' => true,
            'outside' => $outside,
            'distance' => $distance,
            'radius' => $radius,
            'branch' => $branch->name,
            'blocked' => $outside && $mode === self::BLOCK,
        ];
    }

    public static function humanDistance(int $metres): string
    {
        return $metres >= 1000
            ? number_format($metres / 1000, 1) . ' km'
            : $metres . ' m';
    }

    // Haversine — do coordinates ke beech seedhi doori
    private static function distance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return self::EARTH_RADIUS_M * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}

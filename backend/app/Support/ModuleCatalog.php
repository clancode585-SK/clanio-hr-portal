<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Permission table me module ke naam se 35+ groups hain, lekin kuch
 * har role/plan me hamesha chahiye hote hain (apna profile, apna bank,
 * apna document, basic directory dikhna) — unko on/off karne ka
 * koi matlab nahi, isliye Role/Plan ke "pick modules" screen me
 * wo dikhane ki zaroorat nahi.
 */
final class ModuleCatalog
{
    /** Hamesha on — kisi role ya plan se band nahi hote */
    public const COMMON = ['employee', 'employee_family', 'employee_bank', 'employee_document', 'user'];

    /** Role/Plan form me dikhane layak — jo asal me kisi ke liye alag hote hain */
    public static function selectable(): array
    {
        return array_values(array_diff(self::all(), self::COMMON));
    }

    /** Permission table me jitne bhi module hain */
    public static function all(): array
    {
        return DB::table('permissions')->distinct()->pluck('module')->all();
    }
}

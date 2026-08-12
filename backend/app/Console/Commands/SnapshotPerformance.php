<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\PerformanceService;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SnapshotPerformance extends Command
{
    protected $signature = 'performance:snapshot
        {--month= : YYYY-MM, default pichla mahina}
        {--no-freeze : Sirf calculate karo, freeze mat karo}';

    protected $description = 'Har employee ka monthly performance score save aur freeze karta hai';

    public function __construct(private readonly PerformanceService $performance)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $month = $this->option('month');

        $period = $month === null
            ? Carbon::today()->startOfMonth()->subMonth()
            : Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfMonth();

        $freeze = ! $this->option('no-freeze') && $period->lessThan(Carbon::today()->startOfMonth());
        $total = 0;

        foreach (Company::query()->where('status', 'active')->get(['id']) as $company) {
            app(TenantContext::class)->set($company);

            $total += $this->performance->snapshotCompany((int) $company->id, $period, $freeze);
        }

        app(TenantContext::class)->forget();

        $this->info($total . ' employee ka ' . $period->format('Y-m') . ' score save hua'
            . ($freeze ? ' aur freeze ho gaya.' : ' (freeze nahi kiya).'));

        return self::SUCCESS;
    }
}

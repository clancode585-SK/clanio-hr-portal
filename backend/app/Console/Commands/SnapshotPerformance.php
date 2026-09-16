<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\PerformanceService;
use App\Support\CompanyTime;
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
        $freezeAllowed = ! $this->option('no-freeze');
        $total = 0;
        $frozen = 0;
        $periods = [];

        foreach (Company::query()->where('status', 'active')->get(['id']) as $company) {
            app(TenantContext::class)->set($company);

            $thisMonth = CompanyTime::day($company)->startOfMonth();

            $period = $month === null
                ? $thisMonth->copy()->subMonth()
                : Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfMonth();

            $freeze = $freezeAllowed && $period->lessThan($thisMonth);
            $periods[$period->format('Y-m')] = true;

            $saved = $this->performance->snapshotCompany((int) $company->id, $period, $freeze);
            $total += $saved;
            $frozen += $freeze ? $saved : 0;
        }

        app(TenantContext::class)->forget();

        $this->info($total . ' employee ka ' . implode(', ', array_keys($periods)) . ' score save hua'
            . ($frozen > 0 ? ' aur ' . $frozen . ' freeze ho gaya.' : ' (freeze nahi kiya).'));

        return self::SUCCESS;
    }
}

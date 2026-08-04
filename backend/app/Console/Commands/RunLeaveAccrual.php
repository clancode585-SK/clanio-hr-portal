<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\User;
use App\Services\LeaveBalanceService;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class RunLeaveAccrual extends Command
{
    protected $signature = 'leave:accrue
        {--year= : Kaunsa saal, default current}
        {--carry-forward : Accrual ki jagah pichle saal ka carry forward chalao}';

    protected $description = 'Har company ka monthly leave accrual ya saal ka carry forward chalata hai';

    public function __construct(private readonly LeaveBalanceService $balances)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $carryForward = (bool) $this->option('carry-forward');
        $year = (int) ($this->option('year') ?? Carbon::today()->year);

        foreach (Company::query()->where('status', 'active')->get(['id', 'name']) as $company) {
            app(TenantContext::class)->set($company);

            $actor = $this->systemActor($company->id);

            if ($actor === null) {
                $this->warn($company->name . ' — koi admin nahi mila, skip.');

                continue;
            }

            if ($carryForward) {
                $result = $this->balances->carryForward($year - 1, $actor);
                $this->line(sprintf(
                    '%s — carry forward %d se %d: %d moved, %s din lapse',
                    $company->name,
                    $year - 1,
                    $year,
                    $result['moved'] ?? 0,
                    $result['days_lapsed'] ?? 0
                ));

                continue;
            }

            $this->balances->allocate((int) $company->id, $year, $actor);
            $result = $this->balances->accrue($year, $actor);

            $this->line(sprintf(
                '%s — accrue %d: %d credited, %d already done',
                $company->name,
                $year,
                $result['credited'] ?? 0,
                $result['skipped'] ?? 0
            ));
        }

        app(TenantContext::class)->forget();

        return self::SUCCESS;
    }

    private function systemActor(int $companyId): ?User
    {
        return User::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->where('status', 'active')
            ->whereHas('roles', fn ($query) => $query->where('slug', 'company_admin'))
            ->orderBy('id')
            ->first();
    }
}

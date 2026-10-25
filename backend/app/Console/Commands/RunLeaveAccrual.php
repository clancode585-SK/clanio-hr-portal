<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\User;
use App\Services\LeaveBalanceService;
use App\Support\CompanyTime;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Throwable;

class RunLeaveAccrual extends Command
{
    protected $signature = 'leave:accrue
        {--year= : Kaunsa saal, default current}
        {--carry-forward : Accrual ki jagah pichle saal ka carry forward chalao}';

    protected $description = 'Runs monthly leave accrual and the yearly carry forward for every company';

    public function __construct(private readonly LeaveBalanceService $balances)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $carryForward = (bool) $this->option('carry-forward');
        $requested = $this->option('year');

        // Har company apne try/catch me — ek company crash ho to baaki companies ka
        // accrual us raat bhi chal jaana chahiye
        foreach (Company::query()->where('status', 'active')->get(['id', 'name']) as $company) {
            try {
                app(TenantContext::class)->set($company);
                $year = (int) ($requested ?? CompanyTime::now($company)->year);

                $actor = $this->systemActor($company->id);

                if ($actor === null) {
                    $this->warn($company->name . ' — no admin found, skipped.');

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
                    '%s — accrue %d: %d credited, %d already done, %d failed',
                    $company->name,
                    $year,
                    $result['credited'] ?? 0,
                    $result['already_done'] ?? 0,
                    count($result['failed'] ?? [])
                ));
            } catch (Throwable $exception) {
                $this->error($company->name . ' — accrual crashed: ' . $exception->getMessage());
            } finally {
                app(TenantContext::class)->forget();
            }
        }

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

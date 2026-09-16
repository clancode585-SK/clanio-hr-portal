<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\PayrollRun;
use App\Models\SalaryDisbursement;
use App\Models\User;
use App\Services\SalaryDisbursementService;
use App\Support\CompanyTime;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use Illuminate\Console\Command;

class DisburseSalaries extends Command
{
    protected $signature = 'salary:disburse
        {--dry-run : Sirf batao kiski jaayegi, bhejo mat}';

    protected $description = 'Salary date par approved payroll ki salary employees ke account me bhejta hai';

    public function __construct(private readonly SalaryDisbursementService $transfers)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $totalSent = 0;
        $totalFailed = 0;

        foreach (Company::query()->where('status', 'active')->get(['id', 'name']) as $company) {
            app(TenantContext::class)->set($company);

            $today = CompanyTime::day($company)->toDateString();

            $runs = PayrollRun::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $company->id)
                ->where('status', PayrollRun::APPROVED)
                ->whereDate('pay_date', '<=', $today)
                ->orderBy('pay_date')
                ->get();

            foreach ($runs as $run) {
                $actor = $this->systemActor((int) $company->id);

                if ($actor === null) {
                    $this->warn($company->name . ' — koi admin nahi mila, skip.');

                    continue;
                }

                if ($dryRun) {
                    $waiting = $run->items()
                        ->whereIn('payment_status', ['pending', 'failed'])
                        ->where('net_payable', '>', 0)
                        ->count();

                    $this->line(sprintf(
                        '%s — %s: %d salary jaane ko taiyar (pay date %s)',
                        $company->name,
                        $run->monthLabel(),
                        $waiting,
                        $run->pay_date?->format('d M Y') ?? '?'
                    ));

                    continue;
                }

                try {
                    $result = $this->transfers->transferRun($run, $actor, null, SalaryDisbursement::BULK);
                } catch (ApiException $error) {
                    $this->warn($company->name . ' — ' . $run->monthLabel() . ': ' . $error->getMessage());

                    continue;
                }

                $totalSent += $result['sent'];
                $totalFailed += $result['failed'];

                $this->line(sprintf(
                    '%s — %s: %d bheji, %d fail, %d hold par',
                    $company->name,
                    $run->monthLabel(),
                    $result['sent'],
                    $result['failed'],
                    $result['skipped_on_hold']
                ));

                foreach ($result['failures'] as $code => $reason) {
                    $this->warn('    ' . $code . ' — ' . $reason);
                }
            }
        }

        app(TenantContext::class)->forget();

        if ($dryRun) {
            $this->info('Dry run — kuch bheja nahi gaya.');

            return self::SUCCESS;
        }

        $this->info($totalSent . ' salary bheji gayi, ' . $totalFailed . ' fail hui.');

        return self::SUCCESS;
    }

    private function systemActor(int $companyId): ?User
    {
        return User::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->where('status', 'active')
            ->get()
            ->first(fn (User $user): bool => $user->hasPermission(SalaryDisbursement::PERMISSION));
    }
}

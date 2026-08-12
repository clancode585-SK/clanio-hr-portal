<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\EmployeeExit;
use App\Services\ExitService;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class ProcessEmployeeExits extends Command
{
    protected $signature = 'exits:process';

    protected $description = 'Last working date nikal chuke employees ka login band karta hai';

    public function __construct(private readonly ExitService $exits)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $today = Carbon::today();
        $done = 0;

        foreach (Company::query()->where('status', 'active')->get(['id']) as $company) {
            app(TenantContext::class)->set($company);

            $due = EmployeeExit::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->with('employee.user')
                ->where('company_id', $company->id)
                ->where('status', EmployeeExit::SERVING_NOTICE)
                ->whereDate('last_working_date', '<', $today->toDateString())
                ->orderBy('last_working_date')
                ->get();

            foreach ($due as $exit) {
                $this->exits->finalise($exit);
                $this->line('Exit done: ' . ($exit->employee?->employee_code ?? $exit->employee_id));
                $done++;
            }
        }

        app(TenantContext::class)->forget();

        $this->info($done . ' employee exit process kiye gaye.');

        return self::SUCCESS;
    }
}

<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\TicketService;
use App\Support\TenantContext;
use Illuminate\Console\Command;

class EscalateOverdueTickets extends Command
{
    protected $signature = 'tickets:escalate';

    protected $description = 'SLA cross kar chuke tickets ko breach mark karke escalate karta hai';

    public function __construct(private readonly TicketService $tickets)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $count = $this->tickets->escalateOverdue();

        app(TenantContext::class)->forget();

        $this->info($count . ' ticket escalate hue.');

        return self::SUCCESS;
    }
}

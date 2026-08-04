<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\EmployeeDocument;
use App\Services\NotificationService;
use App\Support\NotificationType;
use App\Support\Recipients;
use App\Support\Scopes\CompanyScope;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendDocumentExpiryAlerts extends Command
{
    protected $signature = 'documents:expiry-alerts';

    protected $description = 'Expire hone wale documents ka alert employee aur HR ko bhejta hai';

    private const WINDOWS = [30, 15, 7, 1];

    private const VERIFY_PERMISSION = 'employee_document.verify';

    public function __construct(private readonly NotificationService $notifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $today = Carbon::today();
        $sent = 0;

        foreach (Company::query()->where('status', 'active')->get(['id']) as $company) {
            app(TenantContext::class)->set($company);

            $hr = Recipients::withPermission((int) $company->id, self::VERIFY_PERMISSION);

            foreach (self::WINDOWS as $days) {
                $target = $today->copy()->addDays($days)->toDateString();

                $documents = EmployeeDocument::query()
                    ->withoutGlobalScope(CompanyScope::class)
                    ->where('company_id', $company->id)
                    ->whereDate('expires_on', $target)
                    ->with('employee.user:id,name')
                    ->get();

                foreach ($documents as $document) {
                    $sent += $this->notifyExpiry($document, $days, $hr);
                }
            }

            $expired = EmployeeDocument::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $company->id)
                ->whereDate('expires_on', $today->copy()->subDay()->toDateString())
                ->with('employee.user:id,name')
                ->get();

            foreach ($expired as $document) {
                $sent += $this->notifyExpiry($document, 0, $hr);
            }
        }

        app(TenantContext::class)->forget();

        $this->info($sent . ' document alerts bheje gaye.');

        return self::SUCCESS;
    }

    private function notifyExpiry(EmployeeDocument $document, int $days, array $hr): int
    {
        $employee = $document->employee;

        if ($employee === null) {
            return 0;
        }

        $name = $employee->user?->name ?? $employee->employee_code;
        $expiresOn = Carbon::parse($document->expires_on)->format('d M Y');

        $title = $days === 0
            ? $document->title . ' expire ho gaya'
            : $document->title . ' ' . $days . ' din mein expire ho raha hai';

        $sent = 0;

        if ($employee->user_id !== null) {
            $this->notifications->send((int) $employee->user_id, [
                'type' => NotificationType::DOCUMENT_EXPIRING,
                'title' => $title,
                'body' => 'Expiry: ' . $expiresOn . ' — naya document upload kar do.',
                'action_url' => '/profile/documents',
                'entity_type' => 'employee_document',
                'entity_id' => $document->id,
                'payload' => $this->payload($document, $days),
                'dedupe_key' => 'doc-expiry:' . $document->id . ':' . $days,
            ]);

            $sent++;
        }

        $recipients = Recipients::except($hr, [(int) $employee->user_id]);

        if ($recipients !== [] && ($days === 0 || $days === 7)) {
            $sent += $this->notifications->sendMany($recipients, [
                'type' => NotificationType::DOCUMENT_EXPIRING,
                'title' => $name . ' ka ' . $document->title . ' ' . ($days === 0 ? 'expire ho gaya' : $days . ' din mein expire hoga'),
                'body' => 'Expiry: ' . $expiresOn,
                'action_url' => '/employees/' . $employee->id . '/documents',
                'entity_type' => 'employee_document',
                'entity_id' => $document->id,
                'payload' => $this->payload($document, $days),
                'dedupe_key' => 'doc-expiry-hr:' . $document->id . ':' . $days,
            ]);
        }

        return $sent;
    }

    private function payload(EmployeeDocument $document, int $days): array
    {
        return [
            'document_id' => (int) $document->id,
            'employee_id' => (int) $document->employee_id,
            'type' => $document->type,
            'title' => $document->title,
            'expires_on' => Carbon::parse($document->expires_on)->toDateString(),
            'days_left' => $days,
        ];
    }
}

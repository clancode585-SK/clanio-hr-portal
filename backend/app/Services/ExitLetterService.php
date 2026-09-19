<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\EmployeeExit;
use App\Models\ExitDocument;
use App\Models\User;
use App\Support\CompanyTime;
use App\Support\Pdf;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ExitLetterService
{
    public const GENERATED = 'generated';

    public const UPLOADED = 'uploaded';

    private const PREFIX = [
        ExitDocument::EXPERIENCE_LETTER => 'EXP',
        ExitDocument::RELIEVING_LETTER => 'REL',
        ExitDocument::RECOMMENDATION_LETTER => 'LOR',
        ExitDocument::NO_DUES => 'NDC',
    ];

    public function generate(EmployeeExit $exit, array $data, User $actor): ExitDocument
    {
        $type = (string) $data['type'];

        if (! array_key_exists($type, self::PREFIX)) {
            throw new ApiException('Ye letter system se nahi banta.', 422, 'LETTER_TYPE_UNKNOWN');
        }

        $this->assertIssuable($exit, $type);

        $company = Company::query()->withoutGlobalScopes()->findOrFail($exit->company_id);

        $existing = ExitDocument::query()
            ->where('employee_exit_id', $exit->id)
            ->where('type', $type)
            ->where('source', self::GENERATED)
            ->first();

        $document = $existing ?? new ExitDocument();
        $document->company_id = $exit->company_id;
        $document->employee_exit_id = $exit->id;

        if ($document->created_by === null) {
            $document->created_by = $actor->id;
        }

        $document->forceFill([
            'type' => $type,
            'source' => self::GENERATED,
            'letter_number' => $document->letter_number ?? $this->nextNumber((int) $exit->company_id, $type),
            'issued_on' => $data['issued_on'] ?? CompanyTime::now()->toDateString(),
            'body' => $data['body'] ?? null,
            'remarks' => $data['remarks'] ?? null,
            'signatory_name' => $data['signatory_name'] ?? $company->letter_signatory_name,
            'signatory_designation' => $data['signatory_designation'] ?? $company->letter_signatory_designation,
            'uploaded_by' => $actor->id,
            'updated_by' => $actor->id,
        ])->save();

        return $document->refresh();
    }

    // Relieving letter clearance pending me issue hi nahi hota
    private function assertIssuable(EmployeeExit $exit, string $type): void
    {
        if ($type !== ExitDocument::RELIEVING_LETTER) {
            return;
        }

        $pending = DB::table('exit_clearances')
            ->where('employee_exit_id', $exit->id)
            ->where('is_active', 1)
            ->where('status', 'pending')
            ->count();

        if ($pending > 0) {
            throw new ApiException(
                'Clearance ke ' . $pending . ' item abhi baaki hain — relieving letter nahi ban sakta.',
                409,
                'CLEARANCE_PENDING'
            );
        }
    }

    public function pdf(ExitDocument $document): string
    {
        return Pdf::fromHtml($this->html($document));
    }

    public function html(ExitDocument $document): string
    {
        if ($document->source !== self::GENERATED) {
            throw new ApiException('Ye letter upload kiya gaya tha, system se nahi bana.', 422, 'LETTER_UPLOADED');
        }

        $exit = $document->exit;
        $employee = $exit?->employee;
        $company = Company::query()->withoutGlobalScopes()->findOrFail($document->company_id);

        $name = $employee?->user?->name ?? 'Employee';
        $joined = $employee?->date_of_joining ? Carbon::parse($employee->date_of_joining) : null;
        $lastDay = $exit?->last_working_date ? Carbon::parse($exit->last_working_date) : null;
        $designation = $employee?->designation?->name;

        return view('mail.exit-letter', [
            'document' => $document,
            'company' => $company,
            'title' => ExitDocument::TYPES[$document->type] ?? 'Letter',
            'employeeName' => $name,
            'employeeCode' => $employee?->employee_code ?? '—',
            'designation' => $designation,
            'joinedOn' => $joined?->format('j F Y') ?? '—',
            'lastDay' => $lastDay?->format('j F Y') ?? '—',
            'serviceLabel' => $this->serviceLabel($joined, $lastDay),
            'showTable' => $document->type !== ExitDocument::RECOMMENDATION_LETTER,
            'pronounPossessive' => 'them',
            'paragraphs' => $this->paragraphs($document->type, $name, $designation, $company, $joined, $lastDay),
        ])->render();
    }

    public function fileName(ExitDocument $document): string
    {
        $employee = $document->exit?->employee;

        return str_replace(' ', '-', ExitDocument::TYPES[$document->type] ?? 'Letter')
            . '-' . ($employee?->employee_code ?? 'EMP') . '.pdf';
    }

    private function paragraphs(
        string $type,
        string $name,
        ?string $designation,
        Company $company,
        ?Carbon $joined,
        ?Carbon $lastDay
    ): array {
        $org = e($company->legal_name ?: $company->name);
        $who = '<strong>' . e($name) . '</strong>';
        $role = $designation === null ? '' : ' as <strong>' . e($designation) . '</strong>';
        $from = $joined?->format('j F Y') ?? '—';
        $to = $lastDay?->format('j F Y') ?? '—';

        return match ($type) {
            ExitDocument::EXPERIENCE_LETTER => [
                "This is to certify that {$who} was employed with {$org}{$role} from {$from} to {$to}.",
                'During this period we found them sincere, diligent and professional in their conduct. '
                    . 'Their contribution to the team is acknowledged with appreciation.',
            ],
            ExitDocument::RELIEVING_LETTER => [
                "This is to confirm that {$who} has been relieved from the services of {$org} "
                    . "with effect from the close of business on {$to}.",
                'All company property in their possession has been returned and all dues have been settled. '
                    . 'They stand relieved of all responsibilities with the organisation.',
            ],
            ExitDocument::RECOMMENDATION_LETTER => [
                "I have known {$who} during their tenure at {$org}{$role}, from {$from} to {$to}.",
                'They consistently demonstrated ownership, sound judgement and a willingness to help '
                    . 'those around them. I recommend them without reservation and believe they will be '
                    . 'an asset to any organisation they join.',
            ],
            ExitDocument::NO_DUES => [
                "This is to certify that {$who}, who was employed with {$org}{$role} until {$to}, "
                    . 'has no outstanding dues payable to the company.',
                'All departmental clearances have been obtained and company property has been returned.',
            ],
            default => [],
        };
    }

    private function serviceLabel(?Carbon $joined, ?Carbon $lastDay): string
    {
        if ($joined === null || $lastDay === null) {
            return '—';
        }

        $months = $joined->diffInMonths($lastDay);
        $years = intdiv((int) $months, 12);
        $rest = (int) $months % 12;

        $parts = [];

        if ($years > 0) {
            $parts[] = $years . ' year' . ($years === 1 ? '' : 's');
        }

        if ($rest > 0 || $parts === []) {
            $parts[] = $rest . ' month' . ($rest === 1 ? '' : 's');
        }

        return implode(' ', $parts);
    }

    private function nextNumber(int $companyId, string $type): string
    {
        $year = CompanyTime::now()->year;
        $prefix = self::PREFIX[$type] . '-' . $year . '-';

        $last = ExitDocument::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('letter_number', 'like', $prefix . '%')
            ->orderByDesc('letter_number')
            ->value('letter_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, strlen($prefix))) + 1;

        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}

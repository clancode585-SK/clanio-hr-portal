<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Company;
use App\Models\FnfLine;
use App\Models\FnfSettlement;
use App\Support\Money;

final class FnfStatementService
{
    public function html(FnfSettlement $settlement): string
    {
        $settlement->loadMissing('lines');

        $company = Company::query()->withoutGlobalScopes()->find($settlement->company_id);

        if ($company === null) {
            throw new ApiException('Company record nahi mila.', 404, 'NOT_FOUND');
        }

        $applied = $settlement->lines->filter(fn (FnfLine $line): bool => $line->counts());

        return view('payroll.fnf', [
            'settlement' => $settlement,
            'company' => $company,
            'earnings' => $applied->where('kind', FnfLine::EARNING)->values(),
            'deductions' => $applied->where('kind', FnfLine::DEDUCTION)->values(),
            'skipped' => $settlement->lines
                ->filter(fn (FnfLine $line): bool => $line->isSuggestion() && ! $line->counts())
                ->values(),
            'inWords' => Money::inWords(abs((float) $settlement->net_payable)),
            'rupee' => fn (float|int|string|null $value): string => '₹' . Money::indian($value, 2),
            'days' => fn (float|int|string|null $value): string => rtrim(rtrim(number_format((float) $value, 1, '.', ''), '0'), '.'),
        ])->render();
    }

    public function fileName(FnfSettlement $settlement): string
    {
        return 'FnF-' . $settlement->employee_code . '-'
            . ($settlement->last_working_date?->format('Y-m-d') ?? 'settlement') . '.html';
    }
}

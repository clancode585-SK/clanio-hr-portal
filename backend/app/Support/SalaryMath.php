<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\SalaryComponent;
use Illuminate\Support\Facades\DB;

final class SalaryMath
{
    public static function settings(int $companyId): array
    {
        $row = DB::table('companies')->where('id', $companyId)->first([
            'salary_pay_day',
            'pf_enabled',
            'pf_employee_percent',
            'pf_employer_percent',
            'pf_wage_ceiling',
            'esi_enabled',
            'esi_employee_percent',
            'esi_employer_percent',
            'esi_wage_limit',
            'pt_enabled',
            'pt_monthly_amount',
        ]);

        return [
            'pay_day' => (int) ($row->salary_pay_day ?? 1),
            'pf_enabled' => (bool) ($row->pf_enabled ?? false),
            'pf_employee_percent' => (float) ($row->pf_employee_percent ?? 0),
            'pf_employer_percent' => (float) ($row->pf_employer_percent ?? 0),
            'pf_wage_ceiling' => (float) ($row->pf_wage_ceiling ?? 0),
            'esi_enabled' => (bool) ($row->esi_enabled ?? false),
            'esi_employee_percent' => (float) ($row->esi_employee_percent ?? 0),
            'esi_employer_percent' => (float) ($row->esi_employer_percent ?? 0),
            'esi_wage_limit' => (float) ($row->esi_wage_limit ?? 0),
            'pt_enabled' => (bool) ($row->pt_enabled ?? false),
            'pt_monthly_amount' => (float) ($row->pt_monthly_amount ?? 0),
        ];
    }

    public static function build(float $annualCtc, array $picked, array $settings, bool $hasPfAccount): array
    {
        $monthlyGross = round($annualCtc / 12, 2);

        $earnings = self::earnings($monthlyGross, $picked);
        $basic = self::amountOf($earnings, SalaryComponent::BASIC);

        $statutory = self::statutory($basic, self::sum($earnings), $settings, $hasPfAccount);

        $lines = $earnings;

        foreach ($picked as $row) {
            $component = $row['component'];

            if ($component->isEarning()) {
                continue;
            }

            $lines[] = self::line(
                $component,
                $row['value'],
                $statutory[$component->code] ?? round((float) $row['value'], 2)
            );
        }

        usort($lines, fn (array $a, array $b): int => [$a['sequence'], $a['code']] <=> [$b['sequence'], $b['code']]);

        return $lines;
    }

    public static function totals(array $lines): array
    {
        $earnings = round(self::sum(array_filter($lines, fn (array $l): bool => $l['kind'] === SalaryComponent::EARNING)), 2);
        $deductions = round(self::sum(array_filter($lines, fn (array $l): bool => $l['kind'] === SalaryComponent::DEDUCTION)), 2);
        $employer = round(self::sum(array_filter($lines, fn (array $l): bool => $l['kind'] === SalaryComponent::EMPLOYER_COST)), 2);

        return [
            'monthly_gross' => $earnings,
            'monthly_deductions' => $deductions,
            'monthly_net' => round($earnings - $deductions, 2),
            'monthly_employer_cost' => $employer,
            'annual_gross' => round($earnings * 12, 2),
            'annual_cost_to_company' => round(($earnings + $employer) * 12, 2),
        ];
    }

    private static function earnings(float $monthlyGross, array $picked): array
    {
        $lines = [];
        $basic = 0.0;

        foreach ($picked as $row) {
            $component = $row['component'];

            if (! $component->isEarning() || $component->code !== SalaryComponent::BASIC) {
                continue;
            }

            $basic = $component->calculation === SalaryComponent::PERCENT_OF_GROSS
                ? round($monthlyGross * (float) $row['value'] / 100, 2)
                : round((float) $row['value'], 2);

            $lines[] = self::line($component, $row['value'], $basic);
        }

        $balance = null;
        $used = $basic;

        foreach ($picked as $row) {
            $component = $row['component'];

            if (! $component->isEarning() || $component->code === SalaryComponent::BASIC) {
                continue;
            }

            if ($component->isBalance()) {
                $balance = $row;

                continue;
            }

            $amount = match ($component->calculation) {
                SalaryComponent::PERCENT_OF_BASIC => round($basic * (float) $row['value'] / 100, 2),
                SalaryComponent::PERCENT_OF_GROSS => round($monthlyGross * (float) $row['value'] / 100, 2),
                default => round((float) $row['value'], 2),
            };

            $used += $amount;
            $lines[] = self::line($component, $row['value'], $amount);
        }

        if ($balance !== null) {
            $lines[] = self::line($balance['component'], 0, round(max($monthlyGross - $used, 0), 2));
        }

        return $lines;
    }

    private static function statutory(float $basic, float $gross, array $settings, bool $hasPfAccount): array
    {
        $out = [];

        if ($settings['pf_enabled'] && $hasPfAccount) {
            $wage = $settings['pf_wage_ceiling'] > 0 ? min($basic, $settings['pf_wage_ceiling']) : $basic;

            $out[SalaryComponent::PF_EMPLOYEE] = round($wage * $settings['pf_employee_percent'] / 100, 2);
            $out[SalaryComponent::PF_EMPLOYER] = round($wage * $settings['pf_employer_percent'] / 100, 2);
        } else {
            $out[SalaryComponent::PF_EMPLOYEE] = 0.0;
            $out[SalaryComponent::PF_EMPLOYER] = 0.0;
        }

        if ($settings['esi_enabled'] && $gross <= $settings['esi_wage_limit']) {
            $out[SalaryComponent::ESI_EMPLOYEE] = round($gross * $settings['esi_employee_percent'] / 100, 2);
            $out[SalaryComponent::ESI_EMPLOYER] = round($gross * $settings['esi_employer_percent'] / 100, 2);
        } else {
            $out[SalaryComponent::ESI_EMPLOYEE] = 0.0;
            $out[SalaryComponent::ESI_EMPLOYER] = 0.0;
        }

        $out[SalaryComponent::PROFESSIONAL_TAX] = $settings['pt_enabled']
            ? round($settings['pt_monthly_amount'], 2)
            : 0.0;

        return $out;
    }

    private static function line(SalaryComponent $component, float|int $value, float $amount): array
    {
        return [
            'component_id' => (int) $component->id,
            'code' => $component->code,
            'name' => $component->name,
            'kind' => $component->kind,
            'calculation' => $component->calculation,
            'value' => (float) $value,
            'monthly_amount' => $amount,
            'annual_amount' => round($amount * 12, 2),
            'is_taxable' => $component->is_taxable,
            'is_statutory' => $component->is_statutory,
            'sequence' => (int) $component->sequence,
        ];
    }

    private static function amountOf(array $lines, string $code): float
    {
        foreach ($lines as $line) {
            if ($line['code'] === $code) {
                return (float) $line['monthly_amount'];
            }
        }

        return 0.0;
    }

    private static function sum(array $lines): float
    {
        return array_sum(array_map(fn (array $line): float => (float) $line['monthly_amount'], $lines));
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SalaryComponent extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const EARNING = 'earning';

    public const DEDUCTION = 'deduction';

    public const EMPLOYER_COST = 'employer_cost';

    public const KINDS = [self::EARNING, self::DEDUCTION, self::EMPLOYER_COST];

    public const FIXED = 'fixed';

    public const PERCENT_OF_BASIC = 'percent_of_basic';

    public const PERCENT_OF_GROSS = 'percent_of_gross';

    public const BALANCE = 'balance';

    public const CALCULATIONS = [self::FIXED, self::PERCENT_OF_BASIC, self::PERCENT_OF_GROSS, self::BALANCE];

    public const BASIC = 'BASIC';

    public const PF_EMPLOYEE = 'PF';

    public const PF_EMPLOYER = 'PF_ER';

    public const ESI_EMPLOYEE = 'ESI';

    public const ESI_EMPLOYER = 'ESI_ER';

    public const PROFESSIONAL_TAX = 'PT';

    public const TDS = 'TDS';

    public const LOP = 'LOP';

    public const STATUTORY_CODES = [
        self::PF_EMPLOYEE,
        self::PF_EMPLOYER,
        self::ESI_EMPLOYEE,
        self::ESI_EMPLOYER,
        self::PROFESSIONAL_TAX,
    ];

    public const VIEW_PERMISSION = 'salary_structure.view';

    public const MANAGE_PERMISSION = 'salary_component.manage';

    public const STANDARD = [
        ['code' => self::BASIC, 'name' => 'Basic', 'kind' => self::EARNING, 'calculation' => self::PERCENT_OF_GROSS, 'default_value' => 50, 'is_taxable' => true, 'sequence' => 10],
        ['code' => 'HRA', 'name' => 'House Rent Allowance', 'kind' => self::EARNING, 'calculation' => self::PERCENT_OF_BASIC, 'default_value' => 40, 'is_taxable' => true, 'sequence' => 20],
        ['code' => 'CONV', 'name' => 'Conveyance Allowance', 'kind' => self::EARNING, 'calculation' => self::FIXED, 'default_value' => 1600, 'is_taxable' => true, 'sequence' => 30],
        ['code' => 'MED', 'name' => 'Medical Allowance', 'kind' => self::EARNING, 'calculation' => self::FIXED, 'default_value' => 1250, 'is_taxable' => true, 'sequence' => 40],
        ['code' => 'SPL', 'name' => 'Special Allowance', 'kind' => self::EARNING, 'calculation' => self::BALANCE, 'default_value' => 0, 'is_taxable' => true, 'sequence' => 90, 'note' => 'Gross me jo bacha, wo yahan aa jaata hai'],
        ['code' => self::PF_EMPLOYEE, 'name' => 'Provident Fund', 'kind' => self::DEDUCTION, 'calculation' => self::FIXED, 'default_value' => 0, 'is_statutory' => true, 'is_taxable' => false, 'sequence' => 110, 'note' => 'Company settings ke percent se apne aap nikalta hai'],
        ['code' => self::ESI_EMPLOYEE, 'name' => 'ESI', 'kind' => self::DEDUCTION, 'calculation' => self::FIXED, 'default_value' => 0, 'is_statutory' => true, 'is_taxable' => false, 'sequence' => 120, 'note' => 'Wage limit se neeche hi lagta hai'],
        ['code' => self::PROFESSIONAL_TAX, 'name' => 'Professional Tax', 'kind' => self::DEDUCTION, 'calculation' => self::FIXED, 'default_value' => 0, 'is_statutory' => true, 'is_taxable' => false, 'sequence' => 130, 'note' => 'State ke hisaab se, company settings me set karo'],
        ['code' => self::TDS, 'name' => 'TDS', 'kind' => self::DEDUCTION, 'calculation' => self::FIXED, 'default_value' => 0, 'is_taxable' => false, 'sequence' => 140, 'note' => 'HR chahe to amount daale, warna khaali chhod de'],
        ['code' => self::PF_EMPLOYER, 'name' => 'PF — Employer Share', 'kind' => self::EMPLOYER_COST, 'calculation' => self::FIXED, 'default_value' => 0, 'is_statutory' => true, 'is_taxable' => false, 'affects_net' => false, 'sequence' => 210],
        ['code' => self::ESI_EMPLOYER, 'name' => 'ESI — Employer Share', 'kind' => self::EMPLOYER_COST, 'calculation' => self::FIXED, 'default_value' => 0, 'is_statutory' => true, 'is_taxable' => false, 'affects_net' => false, 'sequence' => 220],
    ];

    protected $fillable = [
        'code',
        'name',
        'kind',
        'calculation',
        'default_value',
        'is_taxable',
        'is_statutory',
        'affects_net',
        'sequence',
        'note',
    ];

    protected $attributes = [
        'kind' => self::EARNING,
        'calculation' => self::FIXED,
        'default_value' => 0,
        'is_taxable' => true,
        'is_statutory' => false,
        'affects_net' => true,
        'sequence' => 100,
    ];

    protected function casts(): array
    {
        return [
            'default_value' => 'float',
            'is_taxable' => 'boolean',
            'is_statutory' => 'boolean',
            'affects_net' => 'boolean',
            'sequence' => 'integer',
        ];
    }

    public function isEarning(): bool
    {
        return $this->kind === self::EARNING;
    }

    public function isDeduction(): bool
    {
        return $this->kind === self::DEDUCTION;
    }

    public function isEmployerCost(): bool
    {
        return $this->kind === self::EMPLOYER_COST;
    }

    public function isBalance(): bool
    {
        return $this->calculation === self::BALANCE;
    }

    public function kindLabel(): string
    {
        return match ($this->kind) {
            self::EARNING => 'Earning',
            self::DEDUCTION => 'Deduction',
            self::EMPLOYER_COST => 'Employer cost',
            default => $this->kind,
        };
    }
}

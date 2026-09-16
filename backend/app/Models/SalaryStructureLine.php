<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryStructureLine extends Model
{
    use BelongsToCompany;

    protected $table = 'salary_structure_lines';

    protected $fillable = [
        'component_id',
        'code',
        'name',
        'kind',
        'calculation',
        'value',
        'monthly_amount',
        'annual_amount',
        'is_taxable',
        'is_statutory',
        'sequence',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'float',
            'monthly_amount' => 'float',
            'annual_amount' => 'float',
            'is_taxable' => 'boolean',
            'is_statutory' => 'boolean',
            'sequence' => 'integer',
        ];
    }

    public function structure(): BelongsTo
    {
        return $this->belongsTo(SalaryStructure::class, 'structure_id');
    }

    public function component(): BelongsTo
    {
        return $this->belongsTo(SalaryComponent::class, 'component_id');
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;

class ClearanceItem extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const IT = 'it';

    public const FINANCE = 'finance';

    public const HR = 'hr';

    public const MANAGER = 'manager';

    public const DEPARTMENTS = [
        self::IT => 'IT — laptop, ID card, access',
        self::FINANCE => 'Finance — advance, loan, dues',
        self::HR => 'HR — documents, exit interview',
        self::MANAGER => 'Manager — handover, KT',
    ];

    public const MANAGE_PERMISSION = 'clearance.manage';

    public const SIGN_PERMISSION = 'clearance.sign';

    protected $fillable = [
        'department',
        'title',
        'description',
        'is_recoverable',
        'is_mandatory',
        'sort_order',
    ];

    protected $attributes = [
        'is_recoverable' => false,
        'is_mandatory' => true,
        'sort_order' => 0,
    ];

    protected $hidden = ['item_key'];

    protected function casts(): array
    {
        return [
            'is_recoverable' => 'boolean',
            'is_mandatory' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['item_key', 'created_at', 'updated_at'];
    }

    public function departmentLabel(): string
    {
        return self::DEPARTMENTS[$this->department] ?? $this->department;
    }
}

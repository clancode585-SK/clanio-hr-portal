<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExitDocument extends Model
{
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const EXPERIENCE_LETTER = 'experience_letter';

    public const RELIEVING_LETTER = 'relieving_letter';

    public const RECOMMENDATION_LETTER = 'recommendation_letter';

    public const NO_DUES = 'no_dues';

    public const OTHER = 'other';

    public const TYPES = [
        self::EXPERIENCE_LETTER => 'Experience Letter',
        self::RELIEVING_LETTER => 'Relieving Letter',
        self::RECOMMENDATION_LETTER => 'Letter of Recommendation',
        self::NO_DUES => 'No Dues Certificate',
        self::OTHER => 'Other',
    ];

    protected $fillable = [
        'type',
        'file_path',
        'original_name',
        'mime_type',
        'size_bytes',
        'issued_on',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'issued_on' => 'date:Y-m-d',
        ];
    }

    public function exit(): BelongsTo
    {
        return $this->belongsTo(EmployeeExit::class, 'employee_exit_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function typeLabel(): string
    {
        return self::TYPES[$this->type] ?? $this->type;
    }
}

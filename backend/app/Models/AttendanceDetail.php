<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceDetail extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;

    protected $fillable = [
        'check_in_at',
        'check_in_latitude',
        'check_in_longitude',
        'check_in_ip',
        'check_out_at',
        'check_out_latitude',
        'check_out_longitude',
        'check_out_ip',
        'worked_minutes',
        'source',
    ];

    protected $attributes = [
        'source' => 'self',
    ];

    protected $hidden = ['open_key'];

    protected function casts(): array
    {
        return [
            'check_in_at' => 'datetime',
            'check_out_at' => 'datetime',
            'check_in_latitude' => 'float',
            'check_in_longitude' => 'float',
            'check_out_latitude' => 'float',
            'check_out_longitude' => 'float',
            'worked_minutes' => 'integer',
        ];
    }

    protected function auditSensitive(): array
    {
        return ['open_key'];
    }

    public function attendance(): BelongsTo
    {
        return $this->belongsTo(Attendance::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function isOpen(): bool
    {
        return $this->check_out_at === null;
    }

    public function elapsedMinutes(): int
    {
        $end = $this->check_out_at ?? now();

        return max(0, (int) $this->check_in_at->diffInMinutes($end));
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveRequestDay extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'leave_date',
        'day_portion',
        'session',
        'status',
    ];

    protected $attributes = [
        'day_portion' => 1.0,
        'status' => LeaveRequest::PENDING,
    ];

    protected function casts(): array
    {
        return [
            'leave_date' => 'date:Y-m-d',
            'day_portion' => 'float',
        ];
    }

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}

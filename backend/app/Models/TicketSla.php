<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class TicketSla extends Model
{
    use Auditable;
    use BelongsToCompany;

    protected $table = 'ticket_slas';

    protected $fillable = [
        'priority',
        'response_hours',
        'resolution_hours',
    ];

    protected function casts(): array
    {
        return [
            'response_hours' => 'integer',
            'resolution_hours' => 'integer',
        ];
    }
}

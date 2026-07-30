<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TaskComment extends Model
{
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = ['body'];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isAuthor(User $actor): bool
    {
        return (int) $this->user_id === (int) $actor->id;
    }
}

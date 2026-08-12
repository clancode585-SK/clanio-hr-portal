<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasActiveState;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Policy extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const DRAFT = 'draft';

    public const PUBLISHED = 'published';

    public const ARCHIVED = 'archived';

    public const STATUSES = [self::DRAFT, self::PUBLISHED, self::ARCHIVED];

    public const CATEGORIES = [
        'hr' => 'HR policy',
        'code_of_conduct' => 'Code of conduct',
        'leave' => 'Leave policy',
        'attendance' => 'Attendance policy',
        'it_security' => 'IT aur security',
        'expense' => 'Expense policy',
        'posh' => 'POSH',
        'safety' => 'Safety',
        'other' => 'Other',
    ];

    public const MANAGE_PERMISSION = 'policy.manage';

    protected $fillable = [
        'category',
        'title',
        'version',
        'summary',
        'body',
        'effective_from',
        'review_on',
        'needs_ack',
        'ack_due_days',
    ];

    protected $attributes = [
        'version' => '1.0',
        'needs_ack' => true,
        'ack_due_days' => 7,
        'status' => self::DRAFT,
    ];

    protected $hidden = ['version_key'];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date:Y-m-d',
            'review_on' => 'date:Y-m-d',
            'needs_ack' => 'boolean',
            'ack_due_days' => 'integer',
            'size_bytes' => 'integer',
            'published_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    protected function auditExcluded(): array
    {
        return ['version_key', 'body', 'created_at', 'updated_at'];
    }

    public function acknowledgements(): HasMany
    {
        return $this->hasMany(PolicyAcknowledgement::class);
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function isDraft(): bool
    {
        return $this->status === self::DRAFT;
    }

    public function isPublished(): bool
    {
        return $this->status === self::PUBLISHED;
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? $this->category;
    }
}

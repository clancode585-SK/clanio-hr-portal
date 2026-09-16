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

class Candidate extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasActiveState;
    use HasUuid;

    public const SOURCES = [
        'website',
        'career_page',
        'referral',
        'linkedin',
        'naukri',
        'google_form',
        'walk_in',
        'agency',
        'other',
    ];

    protected $fillable = [
        'name',
        'email',
        'phone',
        'total_experience',
        'current_company',
        'current_location',
        'current_ctc',
        'expected_ctc',
        'notice_period_days',
        'linkedin_url',
        'source',
        'source_detail',
        'referred_by',
    ];

    protected $attributes = [
        'source' => 'website',
    ];

    protected function casts(): array
    {
        return [
            'total_experience' => 'float',
            'current_ctc' => 'float',
            'expected_ctc' => 'float',
            'notice_period_days' => 'integer',
            'resume_size' => 'integer',
            'portal_visits' => 'integer',
            'portal_opened_at' => 'datetime',
            'portal_last_seen_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_by');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    public function portalPath(): string
    {
        return '/track/' . $this->portal_token;
    }

    public function portalUrl(): string
    {
        return rtrim((string) config('app.url'), '/') . $this->portalPath();
    }

    protected function auditSensitive(): array
    {
        return ['resume_path'];
    }
}

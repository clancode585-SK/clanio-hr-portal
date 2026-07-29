<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Concerns\Auditable;
use App\Support\Concerns\BelongsToCompany;
use App\Support\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeDocument extends Model
{
    use Auditable;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    public const PENDING = 'pending';

    public const VERIFIED = 'verified';

    public const REJECTED = 'rejected';

    public const TYPES = [
        'photo' => 'Passport Photo',
        'aadhaar' => 'Aadhaar Card',
        'pan' => 'PAN Card',
        'resume' => 'Resume',
        'offer_letter' => 'Offer Letter',
        'appointment_letter' => 'Appointment Letter',
        'education_certificate' => 'Education Certificate',
        'experience_letter' => 'Experience Letter',
        'relieving_letter' => 'Relieving Letter',
        'salary_slip' => 'Previous Salary Slip',
        'bank_passbook' => 'Bank Passbook or Cheque',
        'address_proof' => 'Address Proof',
        'other' => 'Other',
    ];

    public const REQUIRED_FOR_ONBOARDING = ['photo', 'aadhaar', 'pan'];

    protected $fillable = [
        'type',
        'title',
        'document_number',
        'issued_on',
        'expires_on',
    ];

    protected $attributes = [
        'status' => self::PENDING,
    ];

    protected function casts(): array
    {
        return [
            'issued_on' => 'date:Y-m-d',
            'expires_on' => 'date:Y-m-d',
            'verified_at' => 'datetime',
            'size_bytes' => 'integer',
        ];
    }

    protected function auditSensitive(): array
    {
        return ['document_number', 'file_path'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function isVerified(): bool
    {
        return $this->status === self::VERIFIED;
    }

    public function isExpired(): bool
    {
        return $this->expires_on !== null && $this->expires_on->isPast();
    }

    public function label(): string
    {
        return self::TYPES[$this->type] ?? $this->type;
    }
}

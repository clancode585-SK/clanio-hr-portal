<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CompanyAdminVerificationMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $code,
        /** Khud pick ki thi to khaali rahega — tab email me nahi dikhayenge */
        public readonly ?string $temporaryPassword,
        public readonly string $companyName
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Verify your ' . config('app.name') . ' account');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.company-admin-verification',
            with: [
                'name' => $this->user->name,
                'email' => $this->user->email,
                'companyName' => $this->companyName,
                'code' => $this->code,
                'temporaryPassword' => $this->temporaryPassword,
                'minutes' => (int) config('auth.token.verification_minutes', 30),
            ]
        );
    }
}

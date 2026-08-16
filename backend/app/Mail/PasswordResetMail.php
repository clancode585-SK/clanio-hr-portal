<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $token
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Reset your ' . config('app.name') . ' password');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.password-reset',
            with: [
                'name' => $this->user->name,
                'resetUrl' => rtrim((string) config('app.frontend_url'), '/') . '/reset-password?token=' . $this->token,
                'token' => $this->token,
                'minutes' => (int) config('auth.token.reset_minutes', 60),
            ]
        );
    }
}

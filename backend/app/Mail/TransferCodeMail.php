<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\TransferVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Support\Money;

class TransferCodeMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly TransferVerification $verification,
        public readonly string $code,
        public readonly string $requestedBy,
        public readonly string $what
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Code to release ' . $this->what);
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.transfer-code',
            with: [
                'code' => $this->code,
                'what' => $this->what,
                'requestedBy' => $this->requestedBy,
                'amount' => '₹' . Money::indian($this->verification->amount, 2),
                'headcount' => (int) $this->verification->headcount,
                'action' => $this->verification->action,
                'scheduledFor' => $this->verification->scheduled_for?->format('d M Y, g:i A'),
                'minutes' => $this->verification->minutesLeft(),
            ]
        );
    }
}

<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Company;
use App\Models\OfferLetter;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OfferLetterMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly Company $company,
        private readonly OfferLetter $letter
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your offer from ' . $this->company->name . ' — ' . $this->letter->role_title,
            replyTo: $this->company->email ? [$this->company->email] : []
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.offer-letter',
            with: [
                'letter' => $this->letter,
                'employer' => $this->company->legal_name ?: $this->company->name,
                'contact' => $this->company->email,
                'trackUrl' => $this->letter->application?->candidate?->portalUrl(),
            ]
        );
    }
}

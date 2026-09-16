<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Application;
use App\Models\Candidate;
use App\Models\Company;
use App\Models\JobOpening;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationReceivedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly Company $company,
        private readonly JobOpening $opening,
        private readonly Candidate $candidate,
        private readonly Application $application
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Thank you for applying for ' . $this->opening->title,
            replyTo: $this->company->email ? [$this->company->email] : []
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.application-received',
            with: [
                'name' => $this->candidate->name,
                'company' => $this->company->name,
                'role' => $this->opening->title,
                'location' => $this->opening->location,
                'reference' => $this->application->uuid,
                'contact' => $this->company->email,
                'trackUrl' => $this->candidate->portalUrl(),
            ]
        );
    }
}

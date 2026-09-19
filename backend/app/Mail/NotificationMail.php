<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Company;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NotificationMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $name,
        public readonly string $subjectLine,
        public readonly string $body,
        public readonly ?string $actionUrl,
        public readonly ?Company $company
    ) {}

    public function envelope(): Envelope
    {
        $from = $this->company?->name ?? config('app.name');

        return new Envelope(subject: $this->subjectLine . ' · ' . $from);
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.notification',
            with: [
                'name' => $this->name,
                'title' => $this->subjectLine,
                'body' => $this->body,
                'actionUrl' => $this->actionUrl,
                'companyName' => $this->company?->name ?? config('app.name'),
            ]
        );
    }
}

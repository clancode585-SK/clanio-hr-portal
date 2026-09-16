<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Company;
use App\Models\Interview;
use App\Support\CompanyTime;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InterviewScheduledMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly Company $company,
        private readonly Interview $interview,
        private readonly bool $rescheduled = false
    ) {}

    public function envelope(): Envelope
    {
        $role = $this->interview->application?->opening?->title ?? 'your application';

        return new Envelope(
            subject: ($this->rescheduled ? 'Your interview has moved — ' : 'Interview scheduled — ') . $role,
            replyTo: $this->company->email ? [$this->company->email] : []
        );
    }

    public function content(): Content
    {
        $interview = $this->interview;
        $application = $interview->application;

        return new Content(
            view: 'mail.interview-scheduled',
            with: [
                'name' => $application?->candidate?->name ?? 'there',
                'company' => $this->company->name,
                'role' => $application?->opening?->title ?? 'the role',
                'round' => $interview->label(),
                'when' => CompanyTime::toZone($interview->scheduled_at, $this->company)
                    ?->format('l, j F Y \a\t g:i A'),
                'zone' => CompanyTime::zone($this->company),
                'minutes' => $interview->duration_minutes,
                'mode' => $interview->mode,
                'joinUrl' => $interview->meeting_url,
                'location' => $interview->location,
                'interviewer' => $interview->interviewer?->name,
                'rescheduled' => $this->rescheduled,
                'contact' => $this->company->email,
                'trackUrl' => $application?->candidate?->portalUrl(),
            ]
        );
    }
}

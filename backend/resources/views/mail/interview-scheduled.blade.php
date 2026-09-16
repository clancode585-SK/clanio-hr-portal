<p>Hi {{ $name }},</p>

@if ($rescheduled)
    <p>Your interview for <strong>{{ $role }}</strong> at {{ $company }} has been moved. Here are the new details.</p>
@else
    <p>Good news — we would like to take your application for <strong>{{ $role }}</strong> at {{ $company }} forward.</p>
@endif

<p>
    <strong>{{ $round }}</strong><br>
    {{ $when }} ({{ $zone }})<br>
    {{ $minutes }} minutes
    @if ($interviewer)
        <br>With {{ $interviewer }}
    @endif
</p>

@if ($mode === 'video' && $joinUrl)
    <p>Join from your browser at the scheduled time — nothing to install:</p>
    <p><a href="{{ $joinUrl }}">{{ $joinUrl }}</a></p>
    <p>Do join from a quiet place with a steady internet connection, and allow your
        camera and microphone when the browser asks.</p>
@elseif ($mode === 'in_person')
    <p>This one is in person{{ $location ? ' at ' . $location : '' }}. Please carry a photo ID.</p>
@else
    <p>We will call you on the number you shared with us.</p>
@endif

<p>If this time does not work for you, reply to this email and we will find another slot.</p>

@if ($trackUrl)
    <p>You can see where your application stands any time:<br>
        <a href="{{ $trackUrl }}">{{ $trackUrl }}</a></p>
@endif

@if ($contact)
    <p>Questions? Write to <a href="mailto:{{ $contact }}">{{ $contact }}</a>.</p>
@endif

<p>{{ $company }}</p>

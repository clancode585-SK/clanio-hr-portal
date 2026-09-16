<p>Dear {{ $letter->candidate_name }},</p>

<p>We are glad to offer you the role of <strong>{{ $letter->role_title }}</strong> at {{ $employer }}.</p>

<p>
    <strong>Letter</strong> {{ $letter->letter_number }}<br>
    @if ($letter->designation)<strong>Designation</strong> {{ $letter->designation }}<br>@endif
    @if ($letter->department)<strong>Department</strong> {{ $letter->department }}<br>@endif
    <strong>Location</strong> {{ $letter->location }}<br>
    <strong>Employment</strong> {{ ucwords(str_replace('_', ' ', $letter->employment_type)) }}<br>
    <strong>Annual CTC</strong> ₹{{ \App\Support\Money::indian($letter->annual_ctc) }}<br>
    <strong>Joining date</strong> {{ $letter->joining_date?->format('j F Y') }}<br>
    @if ($letter->reporting_to)<strong>Reporting to</strong> {{ $letter->reporting_to }}<br>@endif
    @if ($letter->probation_months > 0)<strong>Probation</strong> {{ $letter->probation_months }} months<br>@endif
    <strong>Notice period</strong> {{ $letter->notice_days }} days
</p>

@if ($letter->termList())
    <p><strong>Also please note</strong></p>
    <ul>
        @foreach ($letter->termList() as $line)
            <li>{{ $line }}</li>
        @endforeach
    </ul>
@endif

@if ($letter->valid_till)
    <p>Do let us know by <strong>{{ $letter->valid_till->format('j F Y') }}</strong> whether you accept.</p>
@else
    <p>Do write back and let us know whether you accept.</p>
@endif

<p>This offer is subject to your documents and background checks coming through.</p>

@if ($trackUrl)
    <p>You can see where your application stands any time:<br>
        <a href="{{ $trackUrl }}">{{ $trackUrl }}</a></p>
@endif

@if ($contact)
    <p>Questions? Write to <a href="mailto:{{ $contact }}">{{ $contact }}</a>.</p>
@endif

<p>{{ $employer }}</p>

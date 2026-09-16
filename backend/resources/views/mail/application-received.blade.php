<p>Hi {{ $name }},</p>

<p>Thank you for applying for <strong>{{ $role }}</strong>{{ $location ? ' in ' . $location : '' }} at {{ $company }}.</p>

<p>Your application has reached our team and someone will go through it. If your
background fits the role, we will get in touch about the next step.</p>

<p>Your reference number is <strong>{{ $reference }}</strong>. Do keep it handy if you write to us.</p>

@if ($trackUrl)
    <p>You can see where your application stands any time:<br>
        <a href="{{ $trackUrl }}">{{ $trackUrl }}</a></p>
@endif

@if ($contact)
    <p>Questions? Write to <a href="mailto:{{ $contact }}">{{ $contact }}</a>.</p>
@endif

<p>{{ $company }}</p>

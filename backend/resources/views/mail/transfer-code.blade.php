<p>Hello,</p>

<p>
    {{ $requestedBy }} wants to
    @if ($action === 'schedule')
        schedule
    @else
        release
    @endif
    {{ $what }} of <strong>{{ $amount }}</strong>@if ($headcount > 1) for {{ $headcount }} employees @endif.
</p>

@if ($scheduledFor)
    <p>It would go out on <strong>{{ $scheduledFor }}</strong>.</p>
@endif

<p>The code to allow it is <strong style="font-size:20px;letter-spacing:3px">{{ $code }}</strong></p>

<p>It works for the next {{ $minutes }} minutes and only once.</p>

<p>
    If you were not expecting this, do not share the code. Nothing moves without it.
</p>

<p>{{ config('app.name') }}</p>

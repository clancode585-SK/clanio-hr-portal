<p>Hi {{ $name }},</p>

<p><strong>{{ $title }}</strong></p>

<p>{{ $body }}</p>

@if ($actionUrl)
    <p>Open it in {{ $companyName }} on Clanio: <strong>{{ $actionUrl }}</strong></p>
@endif

<p>
    You are getting this because email is switched on for this kind of update.
    You can turn it off under Notifications &rarr; Preferences.
</p>

<p>{{ $companyName }}</p>

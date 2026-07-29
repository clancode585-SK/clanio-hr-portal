<p>Hi {{ $name }},</p>

<p>We received a request to reset your password. This link works for the next {{ $minutes }} minutes.</p>

<p><a href="{{ $resetUrl }}">Reset my password</a></p>

<p>If the button does not work, use this code: <strong>{{ $token }}</strong></p>

<p>If you did not ask for this, you can ignore this email. Your password stays unchanged.</p>

<p>{{ config('app.name') }}</p>

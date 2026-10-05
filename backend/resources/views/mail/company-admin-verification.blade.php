<p>Hi {{ $name }},</p>

<p>Your workspace <strong>{{ $companyName }}</strong> has been created on {{ config('app.name') }}. Verify your email to activate your account.</p>

<p>Verification code: <strong>{{ $code }}</strong></p>

<p>This code works for the next {{ $minutes }} minutes.</p>

@if ($temporaryPassword)
<p>Your login details:</p>
<p>
    Email: <strong>{{ $email }}</strong><br>
    Temporary password: <strong>{{ $temporaryPassword }}</strong>
</p>
<p>Please change this password after your first sign in.</p>
@endif

<p>{{ config('app.name') }}</p>

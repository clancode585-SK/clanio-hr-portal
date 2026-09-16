<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $letter->letter_number }} — {{ $letter->candidate_name }}</title>
    <style>
        @page { margin: 22mm 18mm; }
        body {
            margin: 0; color: #16181d; background: #fff;
            font: 12pt/1.65 Georgia, "Times New Roman", serif;
        }
        .sheet { max-width: 190mm; margin: 0 auto; padding: 18mm 14mm; }
        header { border-bottom: 2px solid #16181d; padding-bottom: 12px; margin-bottom: 26px; }
        header h1 { font-size: 19pt; margin: 0 0 3px; letter-spacing: -0.3px; }
        header p { margin: 0; font-size: 10pt; color: #555; }
        .ref { display: flex; justify-content: space-between; font-size: 10pt; color: #555; margin-bottom: 26px; }
        h2 { font-size: 13pt; margin: 26px 0 10px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
        th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e2e2e2; font-size: 11pt; }
        th { width: 38%; color: #555; font-weight: normal; }
        td { font-weight: bold; }
        ul { margin: 6px 0 18px; padding-left: 20px; }
        li { margin-bottom: 6px; }
        .sign { margin-top: 46px; display: flex; justify-content: space-between; gap: 40px; }
        .sign div { flex: 1; }
        .line { border-top: 1px solid #16181d; margin-top: 44px; padding-top: 6px; font-size: 10pt; }
        footer { margin-top: 34px; border-top: 1px solid #e2e2e2; padding-top: 10px; font-size: 9pt; color: #777; }
        @media print { .sheet { padding: 0; } }
    </style>
</head>
<body>
<div class="sheet">
    <header>
        <h1>{{ $company->legal_name ?: $company->name }}</h1>
        <p>
            {{ collect([$company->address, $company->city, $company->state, $company->pincode])->filter()->join(', ') }}
            @if ($company->gstin) · GSTIN {{ $company->gstin }} @endif
        </p>
    </header>

    <div class="ref">
        <span>{{ $letter->letter_number }}</span>
        <span>{{ $letter->issued_at?->format('j F Y') }}</span>
    </div>

    <p>Dear {{ $letter->candidate_name }},</p>

    <p>
        We are glad to offer you the role of <strong>{{ $letter->role_title }}</strong> at
        {{ $company->legal_name ?: $company->name }}. The terms of your employment are set out below.
    </p>

    <h2>Your offer</h2>
    <table>
        @if ($letter->designation)
            <tr><th>Designation</th><td>{{ $letter->designation }}</td></tr>
        @endif
        @if ($letter->department)
            <tr><th>Department</th><td>{{ $letter->department }}</td></tr>
        @endif
        <tr><th>Location</th><td>{{ $letter->location }}</td></tr>
        <tr><th>Employment type</th><td>{{ ucwords(str_replace('_', ' ', $letter->employment_type)) }}</td></tr>
        <tr><th>Annual CTC</th><td>₹{{ \App\Support\Money::indian($letter->annual_ctc, 2) }}</td></tr>
        <tr><th>Joining date</th><td>{{ $letter->joining_date?->format('j F Y') }}</td></tr>
        @if ($letter->reporting_to)
            <tr><th>Reporting to</th><td>{{ $letter->reporting_to }}</td></tr>
        @endif
        @if ($letter->probation_months > 0)
            <tr><th>Probation</th><td>{{ $letter->probation_months }} months</td></tr>
        @endif
        <tr><th>Notice period</th><td>{{ $letter->notice_days }} days</td></tr>
        @if ($letter->valid_till)
            <tr><th>Please reply by</th><td>{{ $letter->valid_till->format('j F Y') }}</td></tr>
        @endif
    </table>

    @if ($letter->termList())
        <h2>Other terms</h2>
        <ul>
            @foreach ($letter->termList() as $line)
                <li>{{ $line }}</li>
            @endforeach
        </ul>
    @endif

    <h2>Conditions</h2>
    <ul>
        <li>This offer is subject to your documents and background checks coming through.</li>
        <li>You confirm that you are free of any agreement that stops you from taking this role.</li>
        <li>Company policies in force from time to time will apply to your employment.</li>
    </ul>

    <p>
        We are looking forward to having you with us. Do sign and return a copy of this letter
        to confirm that you accept.
    </p>

    <div class="sign">
        <div>
            <p>For {{ $company->legal_name ?: $company->name }}</p>
            <div class="line">Authorised signatory</div>
        </div>
        <div>
            <p>Accepted by me</p>
            <div class="line">{{ $letter->candidate_name }} · date</div>
        </div>
    </div>

    <footer>
        {{ $letter->letter_number }} · issued {{ $letter->issued_at?->format('j M Y') }}
        @if ($company->email) · {{ $company->email }} @endif
        @if ($company->website) · {{ $company->website }} @endif
    </footer>
</div>
</body>
</html>

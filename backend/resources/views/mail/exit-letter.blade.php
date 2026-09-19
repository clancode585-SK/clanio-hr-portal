<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $document->letter_number }} — {{ $employeeName }}</title>
    <style>
        @page { margin: 22mm 18mm; }
        body {
            margin: 0; color: #16181d; background: #fff;
            font: 12pt/1.7 Georgia, "Times New Roman", serif;
        }
        .sheet { max-width: 190mm; margin: 0 auto; padding: 18mm 14mm; }
        header { border-bottom: 2px solid #16181d; padding-bottom: 12px; margin-bottom: 26px; }
        header h1 { font-size: 19pt; margin: 0 0 3px; letter-spacing: -0.3px; }
        header p { margin: 0; font-size: 10pt; color: #555; }
        .ref { display: flex; justify-content: space-between; font-size: 10pt; color: #555; margin-bottom: 30px; }
        h2 { font-size: 13pt; margin: 0 0 22px; text-align: center; text-transform: uppercase; letter-spacing: 1.5px; }
        p { margin: 0 0 14px; text-align: justify; }
        table { width: 100%; border-collapse: collapse; margin: 18px 0 22px; }
        th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e2e2e2; font-size: 11pt; }
        th { width: 38%; color: #555; font-weight: normal; }
        td { font-weight: bold; }
        .sign { margin-top: 52px; }
        .line { border-top: 1px solid #16181d; width: 62mm; margin-top: 40px; padding-top: 6px; font-size: 10pt; }
        .line strong { display: block; font-size: 11pt; }
        footer { margin-top: 38px; border-top: 1px solid #e2e2e2; padding-top: 10px; font-size: 9pt; color: #777; }
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
        <span>{{ $document->letter_number }}</span>
        <span>{{ $document->issued_on?->format('j F Y') }}</span>
    </div>

    <h2>{{ $title }}</h2>

    @if ($document->type === 'recommendation_letter')
        <p>To whomsoever it may concern,</p>
    @else
        <p>To whomsoever it may concern,</p>
    @endif

    @foreach ($paragraphs as $paragraph)
        <p>{!! $paragraph !!}</p>
    @endforeach

    @if ($showTable)
        <table>
            <tr><th>Employee code</th><td>{{ $employeeCode }}</td></tr>
            <tr><th>Designation</th><td>{{ $designation ?: '—' }}</td></tr>
            <tr><th>Date of joining</th><td>{{ $joinedOn }}</td></tr>
            <tr><th>Last working day</th><td>{{ $lastDay }}</td></tr>
            <tr><th>Period of service</th><td>{{ $serviceLabel }}</td></tr>
        </table>
    @endif

    @if ($document->body)
        @foreach (preg_split('/\R{2,}/', trim($document->body)) as $extra)
            <p>{{ $extra }}</p>
        @endforeach
    @endif

    <p>We wish {{ $pronounPossessive }} the very best for the future.</p>

    <div class="sign">
        <div class="line">
            <strong>{{ $document->signatory_name ?: '—' }}</strong>
            {{ $document->signatory_designation ?: 'Authorised Signatory' }}<br>
            {{ $company->legal_name ?: $company->name }}
        </div>
    </div>

    <footer>
        This is a system generated letter issued by {{ $company->legal_name ?: $company->name }}.
        Reference {{ $document->letter_number }}.
    </footer>
</div>
</body>
</html>

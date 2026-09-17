<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Full and Final {{ $settlement->employee_code }}</title>
    <style>
        @page { margin: 16mm 14mm; }
        body {
            margin: 0; color: #16181d; background: #fff;
            font: 10.5pt/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .sheet { max-width: 195mm; margin: 0 auto; padding: 14mm 12mm; }
        header { border-bottom: 2px solid #16181d; padding-bottom: 12px; margin-bottom: 6px; }
        header h1 { font-size: 17pt; margin: 0 0 3px; letter-spacing: -0.3px; }
        header p { margin: 0; font-size: 9pt; color: #555; }
        .title { text-align: center; margin: 18px 0 20px; }
        .title h2 { font-size: 13pt; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
        .title p { margin: 3px 0 0; font-size: 9.5pt; color: #555; }
        .who { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .who td { padding: 5px 8px; font-size: 9.5pt; border-bottom: 1px solid #eee; vertical-align: top; }
        .who td.k { color: #666; width: 22%; }
        .who td.v { font-weight: 600; width: 28%; }
        .split { display: flex; gap: 14px; align-items: flex-start; }
        .split > div { flex: 1; }
        .money { width: 100%; border-collapse: collapse; }
        .money caption {
            text-align: left; font-size: 9pt; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.7px; color: #555; padding: 0 0 6px;
        }
        .money th, .money td { padding: 6px 8px; font-size: 9.5pt; border-bottom: 1px solid #eee; }
        .money th { text-align: left; font-weight: 400; color: #333; }
        .money td { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .money .basis { display: block; font-size: 8pt; color: #888; font-weight: 400; }
        .money tr.sum th, .money tr.sum td {
            border-top: 1.5px solid #16181d; border-bottom: none; font-weight: 700; padding-top: 8px;
        }
        .net {
            margin-top: 22px; border: 1.5px solid #16181d; padding: 12px 14px;
            display: flex; justify-content: space-between; align-items: baseline;
        }
        .net span { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.7px; }
        .net strong { font-size: 15pt; font-variant-numeric: tabular-nums; }
        .words { margin: 6px 0 0; font-size: 9pt; color: #555; }
        .note { margin-top: 16px; font-size: 9pt; color: #666; }
        .skipped { margin-top: 20px; }
        .skipped h3 {
            font-size: 9pt; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.7px; color: #555; margin: 0 0 6px;
        }
        .skipped table { width: 100%; border-collapse: collapse; }
        .skipped th, .skipped td { padding: 5px 8px; font-size: 9pt; border-bottom: 1px solid #f0f0f0; color: #777; }
        .skipped th { text-align: left; font-weight: 400; }
        .skipped td { text-align: right; font-variant-numeric: tabular-nums; }
        footer { margin-top: 26px; border-top: 1px solid #e2e2e2; padding-top: 9px; font-size: 8.5pt; color: #777; }
        @media print { .sheet { padding: 0; } }
    </style>
</head>
<body>
<div class="sheet">
    <header>
        <h1>{{ $company->legal_name ?: $company->name }}</h1>
        <p>
            {{ collect([$company->address, $company->city, $company->state, $company->pincode])->filter()->join(', ') }}
            @if ($company->pan_number) · PAN {{ $company->pan_number }} @endif
        </p>
    </header>

    <div class="title">
        <h2>Full and Final Settlement</h2>
        <p>Last working day {{ $settlement->last_working_date?->format('j F Y') }}</p>
    </div>

    <table class="who">
        <tr>
            <td class="k">Name</td>
            <td class="v">{{ $settlement->employee_name }}</td>
            <td class="k">Employee code</td>
            <td class="v">{{ $settlement->employee_code }}</td>
        </tr>
        <tr>
            <td class="k">Designation</td>
            <td class="v">{{ $settlement->designation ?: '—' }}</td>
            <td class="k">PAN</td>
            <td class="v">{{ $settlement->pan_number ?: '—' }}</td>
        </tr>
        <tr>
            <td class="k">Date of joining</td>
            <td class="v">{{ $settlement->date_of_joining?->format('j F Y') }}</td>
            <td class="k">UAN</td>
            <td class="v">{{ $settlement->uan_number ?: '—' }}</td>
        </tr>
        <tr>
            <td class="k">Paid days</td>
            <td class="v">{{ $days($settlement->paid_days) }} of {{ $days($settlement->working_days) }}</td>
            <td class="k">Notice period</td>
            <td class="v">
                {{ $settlement->notice_served_days }} of {{ $settlement->notice_required_days }} days served
            </td>
        </tr>
    </table>

    <div class="split">
        <div>
            <table class="money">
                <caption>Earnings</caption>
                @forelse ($earnings as $line)
                    <tr>
                        <th>
                            {{ $line->name }}
                            @if ($line->basis && abs((float) $line->amount - (float) $line->suggested_amount) < 0.01)<span class="basis">{{ $line->basis }}</span>@endif
                        </th>
                        <td>{{ $rupee($line->amount) }}</td>
                    </tr>
                @empty
                    <tr>
                        <th>None</th>
                        <td>{{ $rupee(0) }}</td>
                    </tr>
                @endforelse
                <tr class="sum">
                    <th>Total earnings</th>
                    <td>{{ $rupee($settlement->total_earnings) }}</td>
                </tr>
            </table>
        </div>

        <div>
            <table class="money">
                <caption>Deductions</caption>
                @forelse ($deductions as $line)
                    <tr>
                        <th>
                            {{ $line->name }}
                            @if ($line->basis && abs((float) $line->amount - (float) $line->suggested_amount) < 0.01)<span class="basis">{{ $line->basis }}</span>@endif
                        </th>
                        <td>{{ $rupee($line->amount) }}</td>
                    </tr>
                @empty
                    <tr>
                        <th>None</th>
                        <td>{{ $rupee(0) }}</td>
                    </tr>
                @endforelse
                <tr class="sum">
                    <th>Total deductions</th>
                    <td>{{ $rupee($settlement->total_deductions) }}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="net">
        <span>{{ $settlement->owesCompany() ? 'Recoverable from employee' : 'Net payable' }}</span>
        <strong>{{ $rupee(abs((float) $settlement->net_payable)) }}</strong>
    </div>
    <p class="words">{{ $inWords }}</p>

    @if ($skipped->isNotEmpty())
        <div class="skipped">
            <h3>Not deducted</h3>
            <table>
                @foreach ($skipped as $line)
                    <tr>
                        <th>{{ $line->name }}</th>
                        <td>{{ $rupee($line->suggested_amount) }}</td>
                    </tr>
                @endforeach
            </table>
            <p class="note">
                These were raised for review and waived off. Nothing from this list has been taken out
                of the amount above.
            </p>
        </div>
    @endif

    <footer>
        Computer generated statement — no signature needed.
        Something looks wrong? Write to {{ $company->email ?: 'your HR team' }}.
    </footer>
</div>
</body>
</html>

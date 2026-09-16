<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Payslip {{ $item->employee_code }} — {{ $monthLabel }}</title>
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
        .money td.full { color: #888; font-size: 8.5pt; }
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
        .cost { margin-top: 18px; font-size: 9pt; color: #666; }
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
        <h2>Payslip</h2>
        <p>{{ $monthLabel }}@if ($item->run?->pay_date) · paid on {{ $item->run->pay_date->format('j F Y') }}@endif</p>
    </div>

    <table class="who">
        <tr>
            <td class="k">Name</td>
            <td class="v">{{ $item->employee_name }}</td>
            <td class="k">Employee code</td>
            <td class="v">{{ $item->employee_code }}</td>
        </tr>
        <tr>
            <td class="k">Designation</td>
            <td class="v">{{ $item->designation ?: '—' }}</td>
            <td class="k">PAN</td>
            <td class="v">{{ $item->pan_number ?: '—' }}</td>
        </tr>
        <tr>
            <td class="k">Paid days</td>
            <td class="v">{{ $days($item->paid_days) }} of {{ $days($item->working_days) }}</td>
            <td class="k">UAN</td>
            <td class="v">{{ $item->uan_number ?: '—' }}</td>
        </tr>
        @if ($item->lop_days > 0)
            <tr>
                <td class="k">Loss of pay</td>
                <td class="v">{{ $days($item->lop_days) }} {{ $item->lop_days == 1 ? 'day' : 'days' }}</td>
                <td class="k"></td>
                <td class="v"></td>
            </tr>
        @endif
    </table>

    <div class="split">
        <div>
            <table class="money">
                <caption>Earnings</caption>
                @foreach ($earnings as $line)
                    <tr>
                        <th>{{ $line->name }}</th>
                        @if ($line->amount != $line->full_amount)
                            <td class="full">{{ $rupee($line->full_amount) }}</td>
                        @endif
                        <td>{{ $rupee($line->amount) }}</td>
                    </tr>
                @endforeach
                <tr class="sum">
                    <th>Gross earnings</th>
                    <td @if ($cut) colspan="2" @endif>{{ $rupee($item->gross_earnings) }}</td>
                </tr>
            </table>
        </div>

        <div>
            <table class="money">
                <caption>Deductions</caption>
                @forelse ($deductions as $line)
                    <tr>
                        <th>{{ $line->name }}</th>
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
                    <td>{{ $rupee($item->total_deductions) }}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="net">
        <span>Net pay</span>
        <strong>{{ $rupee($item->net_payable) }}</strong>
    </div>
    <p class="words">{{ $inWords }}</p>

    @if ($item->employer_cost > 0)
        <p class="cost">
            Your employer also puts in {{ $rupee($item->employer_cost) }} this month towards PF and ESI.
            That is not deducted from your pay.
        </p>
    @endif

    @if ($cut)
        <p class="note">
            The grey figure next to an earning is the full month amount. The figure beside it is what was
            paid for {{ $days($item->paid_days) }} days.
        </p>
    @endif

    <footer>
        Computer generated payslip — no signature needed.
        Something looks wrong? Write to {{ $company->email ?: 'your HR team' }}.
    </footer>
</div>
</body>
</html>

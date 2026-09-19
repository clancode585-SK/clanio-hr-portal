<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Payslip {{ $item->employee_code }} — {{ $monthLabel }}</title>
    <style>
        @page { margin: 34px 30px 46px; }

        body {
            margin: 0; padding: 0; color: #1f2933; background: #fff;
            font-family: "DejaVu Sans", sans-serif; font-size: 8.4pt; line-height: 1.45;
        }

        table { border-collapse: collapse; width: 100%; }
        td, th { vertical-align: top; }
        .r { text-align: right; }

        /* ---------- header ---------- */
        .head td { padding: 0 0 10px; }
        .co-name { font-size: 11.5pt; font-weight: bold; color: #1f2933; }
        .co-addr { font-size: 7.4pt; color: #7b8794; line-height: 1.5; }
        .stamp {
            border: 1px solid #e4e7eb; border-radius: 4px; padding: 7px 11px;
            font-size: 9.5pt; font-weight: bold; color: #1f2933; white-space: nowrap;
        }
        .stamp em { display: block; font-style: normal; font-size: 6.6pt; color: #9aa5b1; font-weight: normal; padding-top: 2px; }

        /* ---------- summary strip ---------- */
        .strip { margin: 6px 0 16px; }
        .strip td { padding: 0; }
        .strip .cell { border-left: 3px solid #cbd2d9; padding: 2px 0 2px 9px; }
        .strip .k { font-size: 7.4pt; color: #7b8794; }
        .strip .v { font-size: 12.5pt; font-weight: bold; color: #1f2933; padding-top: 1px; }
        .strip .op { font-size: 13pt; color: #9aa5b1; text-align: center; padding-top: 12px; }
        .net .cell { border-left-color: #1f2933; }
        .gross .cell { border-left-color: #13ab7e; }
        .gross .k, .gross .v { color: #0f8a66; }
        .ded .cell { border-left-color: #e8503a; }
        .ded .k, .ded .v { color: #c9401f; }
        .adv .cell { border-left-color: #f0883e; }
        .adv .k, .adv .v { color: #cc6a1f; }

        /* ---------- left column: employee ---------- */
        .who td { padding: 0 0 9px; }
        .who .k { font-size: 7.2pt; color: #9aa5b1; }
        .who .v { font-size: 8.6pt; font-weight: bold; color: #1f2933; }

        /* ---------- money blocks ---------- */
        .block { margin-bottom: 16px; }
        .block-title { font-size: 9.2pt; font-weight: bold; color: #1f2933; padding-bottom: 5px; }
        .block-note { font-size: 7pt; color: #9aa5b1; font-weight: normal; }
        .grid th {
            font-size: 7.2pt; color: #52606d; text-transform: none; font-weight: bold;
            background: #f5f7fa; padding: 6px 9px; text-align: left; border-bottom: 1px solid #e4e7eb;
        }
        .grid td { font-size: 8.2pt; padding: 6px 9px; border-bottom: 1px solid #f0f2f5; }
        .grid tr.alt td { background: #fafbfc; }
        .grid tr.total td {
            background: #f5f7fa; font-weight: bold; border-bottom: none; border-top: 1px solid #e4e7eb;
        }
        .grid .full { color: #9aa5b1; font-size: 7.2pt; }
        .green th { background: #eefbf5; color: #0f8a66; border-bottom-color: #d3f0e3; }
        .green tr.total td { background: #eefbf5; color: #0f8a66; border-top-color: #d3f0e3; }
        .red th { background: #fef0ee; color: #c9401f; border-bottom-color: #fbd9d3; }
        .red tr.total td { background: #fef0ee; color: #c9401f; border-top-color: #fbd9d3; }
        .violet th { background: #f2effd; color: #5b39d6; border-bottom-color: #ddd5f8; }
        .violet tr.total td { background: #f2effd; color: #5b39d6; border-top-color: #ddd5f8; }
        .slate th { background: #f5f7fa; color: #3e4c59; }
        .slate tr.total td { background: #f5f7fa; color: #1f2933; }

        .words { font-size: 7.4pt; color: #7b8794; padding: 2px 0 14px; }

        /* ---------- month grid ---------- */
        .months td {
            width: 16.6%; padding: 9px 6px; font-size: 7.6pt; border-bottom: 1px solid #f0f2f5;
        }
        .months .m { color: #7b8794; }
        .months .a { font-size: 9pt; font-weight: bold; color: #1f2933; padding-top: 2px; }
        .star { color: #e8503a; }

        .foot {
            position: fixed; bottom: -30px; left: 0; right: 0;
            font-size: 6.8pt; color: #9aa5b1; border-top: 1px solid #f0f2f5; padding-top: 6px;
        }
    </style>
</head>
<body>

<div class="foot">
    <table>
        <tr>
            <td class="pg"></td>
            <td class="r">This is a computer generated payslip and does not require a signature</td>
        </tr>
    </table>
</div>

{{-- ============ header ============ --}}
<table class="head">
    <tr>
        <td style="width: 70%">
            <div class="co-name">{{ $company->legal_name ?: $company->name }}</div>
            <div class="co-addr">
                {{ collect([$company->address, $company->city, $company->state, $company->pincode])->filter()->join(', ') }}
            </div>
        </td>
        <td class="r" style="width: 30%">
            <span class="stamp">
                Payslip: {{ $monthLabel }}
                @if ($item->run?->pay_date)
                    <em>Paid on {{ $item->run->pay_date->format('d M Y') }}</em>
                @endif
            </span>
        </td>
    </tr>
</table>

{{-- ============ net pay = gross - deductions - advance ============ --}}
<table class="strip">
    <tr>
        <td style="width: 22%" class="net">
            <div class="cell">
                <div class="k">Net Pay</div>
                <div class="v">{{ $money($item->net_payable) }}</div>
            </div>
        </td>
        <td style="width: 5%" class="op">=</td>
        <td style="width: 23%" class="gross">
            <div class="cell">
                <div class="k">Gross Pay (A)</div>
                <div class="v">+ {{ $money($item->gross_earnings) }}</div>
            </div>
        </td>
        <td style="width: 25%" class="ded">
            <div class="cell">
                <div class="k">Deductions (B)</div>
                <div class="v">- {{ $money($deductionTotal) }}</div>
            </div>
        </td>
        @if ($advance > 0)
            <td style="width: 25%" class="adv">
                <div class="cell">
                    <div class="k">Advance Salary</div>
                    <div class="v">- {{ $money($advance) }}</div>
                </div>
            </td>
        @endif
    </tr>
</table>

{{-- ============ employee details + earnings / deductions ============ --}}
<table>
    <tr>
        <td style="width: 27%; padding-right: 20px">
            <table class="who">
                <tr><td><div class="k">Employee Code</div><div class="v">{{ $item->employee_code }}</div></td></tr>
                <tr><td><div class="k">Name</div><div class="v">{{ $item->employee_name }}</div></td></tr>
                <tr><td><div class="k">Designation</div><div class="v">{{ $item->designation ?: '—' }}</div></td></tr>
                @if ($profile['department'])
                    <tr><td><div class="k">Department</div><div class="v">{{ $profile['department'] }}</div></td></tr>
                @endif
                @if ($employee?->date_of_birth)
                    <tr><td><div class="k">Date of birth</div><div class="v">{{ $employee->date_of_birth->format('d/m/Y') }}</div></td></tr>
                @endif
                <tr><td><div class="k">PAN</div><div class="v">{{ $item->pan_number ?: '—' }}</div></td></tr>
                <tr><td><div class="k">UAN</div><div class="v">{{ $item->uan_number ?: '—' }}</div></td></tr>
                @if ($profile['account_number'])
                    <tr><td><div class="k">Account no.</div><div class="v">{{ $profile['account_number'] }}</div></td></tr>
                    <tr><td><div class="k">IFSC code</div><div class="v">{{ $profile['ifsc_code'] ?: '—' }}</div></td></tr>
                @endif
                @if ($employee?->date_of_joining)
                    <tr><td><div class="k">Date of joining</div><div class="v">{{ $employee->date_of_joining->format('d/m/Y') }}</div></td></tr>
                @endif
                <tr><td><div class="k">Payable Days</div><div class="v">{{ $days($item->paid_days) }} of {{ $days($item->working_days) }}</div></td></tr>
                @if ($item->lop_days > 0)
                    <tr><td><div class="k">Loss of Pay</div><div class="v">{{ $days($item->lop_days) }}</div></td></tr>
                @endif
                @if ($tax)
                    <tr><td><div class="k">Regime Opted</div><div class="v">New Regime</div></td></tr>
                @endif
            </table>
        </td>

        <td style="width: 73%">
            {{-- earnings --}}
            <div class="block">
                <div class="block-title">
                    Gross Pay (A)
                    <span class="block-note">&nbsp; The total money you earned before the deductions</span>
                </div>
                <table class="grid green">
                    <tr>
                        <th style="width: 58%">Earnings</th>
                        <th class="r" style="width: 21%">Monthly</th>
                        <th class="r" style="width: 21%">Total Amount</th>
                    </tr>
                    @foreach ($earnings as $index => $line)
                        <tr class="{{ $index % 2 ? 'alt' : '' }}">
                            <td>{{ $line->name }}</td>
                            <td class="r {{ $line->amount != $line->full_amount ? 'full' : '' }}">{{ $money($line->full_amount) }}</td>
                            <td class="r">{{ $money($line->amount) }}</td>
                        </tr>
                    @endforeach
                    <tr class="total">
                        <td colspan="2" class="r">Gross Pay</td>
                        <td class="r">{{ $money($item->gross_earnings) }}</td>
                    </tr>
                </table>
            </div>

            {{-- deductions --}}
            <div class="block">
                <div class="block-title">
                    Deductions (B)
                    <span class="block-note">&nbsp; The amount deducted for taxes and other benefits</span>
                </div>
                <table class="grid red">
                    <tr>
                        <th style="width: 58%">Deductions</th>
                        <th class="r" style="width: 21%">Monthly</th>
                        <th class="r" style="width: 21%">Total Amount</th>
                    </tr>
                    @forelse ($deductions as $index => $line)
                        <tr class="{{ $index % 2 ? 'alt' : '' }}">
                            <td>{{ $line->name }}</td>
                            <td class="r">{{ $money($line->full_amount) }}</td>
                            <td class="r">{{ $money($line->amount) }}</td>
                        </tr>
                    @empty
                        <tr><td>None</td><td class="r">0</td><td class="r">0</td></tr>
                    @endforelse
                    <tr class="total">
                        <td colspan="2" class="r">Total Deductions</td>
                        <td class="r">{{ $money($deductionTotal) }}</td>
                    </tr>
                </table>
            </div>

            @if ($advance > 0)
                <div class="block">
                    <div class="block-title">
                        Advance Salary
                        <span class="block-note">&nbsp; EMI recovered from this month's salary</span>
                    </div>
                    <table class="grid slate">
                        <tr>
                            <th style="width: 79%">Recovery</th>
                            <th class="r" style="width: 21%">Total Amount</th>
                        </tr>
                        <tr>
                            <td>Advance Salary Recovery</td>
                            <td class="r">{{ $money($advance) }}</td>
                        </tr>
                    </table>
                </div>
            @endif

            <div class="words">Net pay in words: {{ $inWords }}</div>
        </td>
    </tr>
</table>

{{-- ============ page 2 — tax ============ --}}
@if ($tax)
    <div style="page-break-before: always"></div>

    <div class="block">
        <div class="block-title">
            Yearly Taxable Income (C)
            <span class="block-note">&nbsp; The money you will earn annually excluding the exemptions you declare</span>
        </div>
        <table class="grid violet">
            <tr>
                <th style="width: 46%">Description</th>
                <th class="r" style="width: 18%">Gross</th>
                <th class="r" style="width: 18%">Exempted</th>
                <th class="r" style="width: 18%">Taxable</th>
            </tr>
            @foreach ($tax['rows'] as $index => $row)
                <tr class="{{ $index % 2 ? 'alt' : '' }}">
                    <td>{{ $row['name'] }}</td>
                    <td class="r">{{ $money($row['gross']) }}</td>
                    <td class="r">{{ $money($row['exempted']) }}</td>
                    <td class="r">{{ $money($row['taxable']) }}</td>
                </tr>
            @endforeach
            <tr class="total">
                <td colspan="3" class="r">Annual Taxable Salary</td>
                <td class="r">{{ $money($tax['annual_taxable_salary']) }}</td>
            </tr>
        </table>
    </div>

    <div class="block">
        <div class="block-title">
            Net Taxable Income (E)
            <span class="block-note">&nbsp; Your taxes are calculated on this amount after all deductions</span>
        </div>
        <table class="grid green">
            <tr>
                <th style="width: 79%">Details</th>
                <th class="r" style="width: 21%">Amount</th>
            </tr>
            <tr>
                <td>Annual Taxable Salary (C)</td>
                <td class="r">{{ $money($tax['annual_taxable_salary']) }}</td>
            </tr>
            <tr class="alt">
                <td>Standard Deduction (Section 16)</td>
                <td class="r">- {{ $money($tax['standard_deduction']) }}</td>
            </tr>
            <tr class="total">
                <td class="r">Net Taxable Income</td>
                <td class="r">{{ $money($tax['net_taxable_income']) }}</td>
            </tr>
        </table>
    </div>

    <div class="block">
        <div class="block-title">
            Tax for {{ $tax['financial_year'] }}
            <span class="block-note">&nbsp; Tax on the net taxable salary after all exemptions — New Regime, section 115BAC</span>
        </div>
        <table class="grid red">
            <tr>
                <th style="width: 79%">Details</th>
                <th class="r" style="width: 21%">Amount</th>
            </tr>
            <tr>
                <td>Tax on Taxable Income</td>
                <td class="r">{{ $money($tax['tax_on_income']) }}</td>
            </tr>
            @if ($tax['rebate'] > 0)
                <tr class="alt">
                    <td>Rebate under Section 87A</td>
                    <td class="r">- {{ $money($tax['rebate']) }}</td>
                </tr>
            @endif
            @if ($tax['cess'] > 0)
                <tr>
                    <td>Health &amp; Education Cess (4%)</td>
                    <td class="r">{{ $money($tax['cess']) }}</td>
                </tr>
            @endif
            <tr class="alt">
                <td>Net Tax</td>
                <td class="r">{{ $money($tax['annual_tax']) }}</td>
            </tr>
            <tr>
                <td>Tax Deducted Till Date (Current Employer)</td>
                <td class="r">{{ $money($tax['deducted_till_date']) }}</td>
            </tr>
            <tr class="total">
                <td class="r">Tax To Be Deducted This Year</td>
                <td class="r">{{ $money($tax['remaining_tax']) }}</td>
            </tr>
        </table>
    </div>

    <div class="block">
        <div class="block-title">
            Tax for {{ $monthLabel }}
            <span class="block-note">&nbsp; Tax to be deducted / {{ $tax['months_left'] }} payroll {{ $tax['months_left'] === 1 ? 'execution' : 'executions' }} left in this financial year</span>
        </div>
        <table class="grid slate">
            <tr class="total">
                <td class="r" style="width: 79%">Tax Deducted This Month</td>
                <td class="r" style="width: 21%">{{ $money($tax['this_month']) }}</td>
            </tr>
        </table>
    </div>

    <div class="block">
        <div class="block-title">
            Monthly tax
            <span class="block-note">&nbsp; Projected TDS for the rest of the year is marked with *</span>
        </div>
        <table class="months">
            @foreach (array_chunk($tax['months'], 6) as $row)
                <tr>
                    @foreach ($row as $cell)
                        <td>
                            <div class="m">{{ $cell['label'] }} @if ($cell['projected'])<span class="star">*</span>@endif</div>
                            <div class="a">{{ $money($cell['amount']) }}</div>
                        </td>
                    @endforeach
                </tr>
            @endforeach
        </table>
        <div class="words">* These may change if there is a change in your income.</div>
    </div>
@endif

</body>
</html>

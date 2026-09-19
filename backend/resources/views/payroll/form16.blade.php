@php
    $rs = static fn ($value): string => number_format((float) $value, 2);
    $orgName = $company->legal_name ?: $company->name;
    $orgAddress = collect([$company->address, $company->city, $company->state, $company->pincode])->filter()->join(', ');
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Form 16 Part B — {{ $employee_name }} — {{ $financial_year }}</title>
    <style>
        @page { margin: 12mm 10mm; }
        body { margin: 0; color: #000; background: #fff; font: 9pt/1.35 "Times New Roman", Times, serif; }
        .sheet { max-width: 200mm; margin: 0 auto; padding: 10mm; }
        .center { text-align: center; }
        h1 { font-size: 13pt; margin: 0 0 2px; letter-spacing: 0.5px; }
        h2 { font-size: 11pt; margin: 6px 0; letter-spacing: 1px; }
        .rule { font-size: 8.5pt; margin: 0 0 8px; }
        .intro { font-size: 8pt; margin: 0 0 10px; }
        table { width: 100%; border-collapse: collapse; }
        table.box, table.box th, table.box td { border: 1px solid #000; }
        th, td { padding: 4px 6px; vertical-align: top; font-size: 8.5pt; text-align: left; }
        th { font-weight: bold; }
        .amt { text-align: right; white-space: nowrap; width: 90px; font-variant-numeric: tabular-nums; }
        .num { width: 26px; text-align: left; }
        .bold td, .bold th { font-weight: bold; }
        .head td { font-weight: bold; background: #f2f2f2; }
        .sub { padding-left: 16px; }
        .note { font-size: 7.5pt; margin-top: 10px; }
        .note b { display: block; margin-bottom: 2px; }
        .flag { border: 1px solid #000; padding: 6px 8px; font-size: 8pt; margin-top: 10px; background: #fafafa; }
        .spacer { height: 8px; }
    </style>
</head>
<body>
<div class="sheet">

    <div class="center">
        <h1>FORM NO. 16</h1>
        <div class="rule">[See rule 31(1)(a)]</div>
        <h2>PART B</h2>
        <div class="intro">
            Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source on salary paid to an
            employee under section 192 or pension/interest income of specified senior citizen under section 194P
        </div>
    </div>

    <table class="box">
        <tr>
            <th style="width:50%">Name and address of the Employer/Specified Bank</th>
            <th style="width:50%">Name and address of the Employee/Specified senior citizen</th>
        </tr>
        <tr>
            <td>
                {{ strtoupper($orgName) }}<br>
                {{ $orgAddress ?: '—' }}<br>
                {{ $company->email ?: '' }}
            </td>
            <td>
                {{ strtoupper($employee_name) }}<br>
                {{ $employee->current_address ?: $employee->permanent_address ?: '—' }}
            </td>
        </tr>
        <tr>
            <th>PAN of the Deductor</th>
            <th>TAN of the Deductor</th>
        </tr>
        <tr>
            <td>{{ $company->pan_number ?: '—' }}</td>
            <td>{{ $company->tan_number ?: '—' }}</td>
        </tr>
        <tr>
            <th>PAN of the Employee/Specified senior citizen</th>
            <th>Assessment Year</th>
        </tr>
        <tr>
            <td>{{ $pan ?: '—' }}</td>
            <td>{{ $assessment_year }}</td>
        </tr>
        <tr>
            <th>CIT (TDS)</th>
            <th>Period with the Employer</th>
        </tr>
        <tr>
            <td>{{ $company->cit_tds_address ?: '—' }}</td>
            <td>From {{ $period['from'] }} &nbsp;&nbsp; To {{ $period['to'] }}</td>
        </tr>
    </table>

    <div class="spacer"></div>
    <div class="center" style="font-size:8.5pt">Annexure - I</div>

    <table class="box">
        <tr class="head"><td colspan="4">Details of Salary Paid and any other income and tax deducted</td></tr>

        <tr>
            <td class="num">A</td>
            <td colspan="2">Whether opting out of taxation u/s 115BAC(1A)?</td>
            <td class="amt">{{ $opted_out_115bac }}</td>
        </tr>

        <tr class="bold">
            <td class="num">1.</td><td colspan="2">Gross Salary</td><td class="amt">Rs.</td>
        </tr>
        <tr><td class="num">(a)</td><td colspan="2" class="sub">Salary as per provisions contained in section 17(1)</td><td class="amt">{{ $rs($salary_17_1) }}</td></tr>
        <tr><td class="num">(b)</td><td colspan="2" class="sub">Value of perquisites under section 17(2)</td><td class="amt">{{ $rs($perquisites_17_2) }}</td></tr>
        <tr><td class="num">(c)</td><td colspan="2" class="sub">Profits in lieu of salary under section 17(3)</td><td class="amt">{{ $rs($profits_17_3) }}</td></tr>
        <tr class="bold"><td class="num">(d)</td><td colspan="2" class="sub">Total</td><td class="amt">{{ $rs($gross_total_1d) }}</td></tr>
        <tr><td class="num">(e)</td><td colspan="2" class="sub">Reported total amount of salary received from other employer(s)</td><td class="amt">{{ $rs($other_employer_1e) }}</td></tr>

        <tr class="bold"><td class="num">2.</td><td colspan="3">Less: Allowances to the extent exempt under section 10</td></tr>
        <tr><td class="num">(a)</td><td colspan="2" class="sub">Travel concession or assistance under section 10(5)</td><td class="amt">0.00</td></tr>
        <tr><td class="num">(b)</td><td colspan="2" class="sub">Death-cum-retirement gratuity under section 10(10)</td><td class="amt">0.00</td></tr>
        <tr><td class="num">(c)</td><td colspan="2" class="sub">Commuted value of pension under section 10(10A)</td><td class="amt">0.00</td></tr>
        <tr><td class="num">(d)</td><td colspan="2" class="sub">Cash equivalent of leave salary encashment under section 10(10AA)</td><td class="amt">0.00</td></tr>
        <tr><td class="num">(e)</td><td colspan="2" class="sub">House rent allowance under section 10(13A)</td><td class="amt">0.00</td></tr>
        <tr><td class="num">(f)</td><td colspan="2" class="sub">Other special allowances under section 10(14)</td><td class="amt">{{ $rs($exempt_total_2i) }}</td></tr>
        <tr><td class="num">(g)</td><td colspan="2" class="sub">Amount of any other exemption under section 10 <i>[break-up below]</i></td><td class="amt"></td></tr>
        <tr><td class="num">(h)</td><td colspan="2" class="sub">Total amount of any other exemption under section 10</td><td class="amt">0.00</td></tr>
        <tr class="bold"><td class="num">(i)</td><td colspan="2" class="sub">Total amount of exemption claimed under section 10</td><td class="amt">{{ $rs($exempt_total_2i) }}</td></tr>

        <tr class="bold"><td class="num">3.</td><td colspan="2">Total amount of salary received from current employer [1(d)-2(i)]</td><td class="amt">{{ $rs($from_employer_3) }}</td></tr>

        <tr class="bold"><td class="num">4.</td><td colspan="3">Less: Deductions under section 16</td></tr>
        <tr><td class="num">(a)</td><td colspan="2" class="sub">Standard deduction under section 16(ia)</td><td class="amt">{{ $rs($standard_deduction_4a) }}</td></tr>
        <tr><td class="num">(b)</td><td colspan="2" class="sub">Entertainment allowance under section 16(ii)</td><td class="amt">{{ $rs($entertainment_4b) }}</td></tr>
        <tr><td class="num">(c)</td><td colspan="2" class="sub">Tax on employment under section 16(iii)</td><td class="amt">{{ $rs($employment_tax_4c) }}</td></tr>
        <tr class="bold"><td class="num">5.</td><td colspan="2">Total amount of deductions under section 16 [4(a)+4(b)+4(c)]</td><td class="amt">{{ $rs($section16_total_5) }}</td></tr>
        <tr class="bold"><td class="num">6.</td><td colspan="2">Income chargeable under the head "Salaries" [(3+1(e)-5]</td><td class="amt">{{ $rs($chargeable_6) }}</td></tr>

        <tr class="bold"><td class="num">7.</td><td colspan="3">Add: Any other income reported by the employee as per section 192(2B)</td></tr>
        <tr><td class="num">(a)</td><td colspan="2" class="sub">Income (or admissible loss) from house property reported by employee</td><td class="amt">{{ $rs($house_property_7a) }}</td></tr>
        <tr><td class="num">(b)</td><td colspan="2" class="sub">Income under the head Other Sources offered for TDS</td><td class="amt">{{ $rs($other_sources_7b) }}</td></tr>
        <tr class="bold"><td class="num">8.</td><td colspan="2">Total amount of other income reported by the employee [7(a)+7(b)]</td><td class="amt">{{ $rs($other_income_8) }}</td></tr>
        <tr class="bold"><td class="num">9.</td><td colspan="2">Gross total income (6+8)</td><td class="amt">{{ $rs($gross_total_income_9) }}</td></tr>

        <tr class="bold">
            <td class="num">10.</td><td>Deductions under Chapter VI-A</td>
            <td class="amt">Gross Amount</td><td class="amt">Deductible Amount</td>
        </tr>
        @foreach ([
            '(a)' => 'Deduction in respect of life insurance premia, contributions to provident fund etc. under section 80C',
            '(b)' => 'Deduction in respect of contribution to certain pension funds under section 80CCC',
            '(c)' => 'Deduction in respect of contribution by taxpayer to pension scheme under section 80CCD (1)',
            '(d)' => 'Total deduction under section 80C, 80CCC and 80CCD(1)',
            '(e)' => 'Deductions in respect of amount paid/deposited to notified pension scheme under section 80CCD (1B)',
            '(f)' => 'Deduction in respect of contribution by Employer to pension scheme under section 80CCD (2)',
            '(g)' => 'Deduction in respect of health insurance premia under section 80D',
            '(h)' => 'Deduction in respect of interest on loan taken for higher education under section 80E',
            '(k)' => 'Total Deduction in respect of donations to certain funds, charitable institutions, etc. under section 80G',
            '(l)' => 'Deduction in respect of interest on deposits in savings account',
            '(n)' => 'Total of amount deductible under any other provision(s) of Chapter VI-A',
        ] as $key => $label)
            <tr><td class="num">{{ $key }}</td><td class="sub">{{ $label }}</td><td class="amt">0.00</td><td class="amt">0.00</td></tr>
        @endforeach
        <tr class="bold"><td class="num">11.</td><td colspan="2">Aggregate of deductible amount under Chapter VI-A</td><td class="amt">{{ $rs($chapter_via_11) }}</td></tr>

        <tr class="bold"><td class="num">12.</td><td colspan="2">Total taxable income (9-11)</td><td class="amt">{{ $rs($taxable_income_12) }}</td></tr>
        <tr><td class="num">13.</td><td colspan="2">Tax on total income</td><td class="amt">{{ $rs($tax_on_income_13) }}</td></tr>
        <tr><td class="num">14.</td><td colspan="2">Rebate under section 87A, if applicable</td><td class="amt">{{ $rs($rebate_87a_14) }}</td></tr>
        <tr><td class="num">15.</td><td colspan="2">Surcharge, wherever applicable</td><td class="amt">{{ $rs($surcharge_15) }}</td></tr>
        <tr><td class="num">16.</td><td colspan="2">Health and education cess</td><td class="amt">{{ $rs($cess_16) }}</td></tr>
        <tr class="bold"><td class="num">17.</td><td colspan="2">Tax payable (13+15+16-14)</td><td class="amt">{{ $rs($tax_payable_17) }}</td></tr>
        <tr><td class="num">18.</td><td colspan="2">Less: Relief under section 89 (attach details)</td><td class="amt">{{ $rs($relief_89_18) }}</td></tr>
        <tr><td class="num">19.</td><td colspan="2">Less: Tax deducted at source as per Form No. 12BAA under section 192(2B)</td><td class="amt">{{ $rs($tds_12baa_19) }}</td></tr>
        <tr><td class="num">20.</td><td colspan="2">Less: Tax collected at source as per Form No. 12BAA under section 192(2B)</td><td class="amt">{{ $rs($tcs_12baa_20) }}</td></tr>
        <tr class="bold"><td class="num">21.</td><td colspan="2">Net tax payable (17-18-19-20)</td><td class="amt">{{ $rs($net_tax_payable_21) }}</td></tr>
    </table>

    <div class="spacer"></div>

    <table class="box">
        <tr class="head"><td colspan="2">Verification</td></tr>
        <tr>
            <td colspan="2">
                I, <b>{{ strtoupper($company->letter_signatory_name ?: '—') }}</b>,
                son/daughter of <b>{{ strtoupper($company->letter_signatory_parent ?: '—') }}</b>,
                working in the capacity of <b>{{ strtoupper($company->letter_signatory_designation ?: '—') }}</b> (Designation)
                do hereby certify that the information given above is true, complete and correct and is based on the
                books of account, documents, TDS statements, and other available records.
            </td>
        </tr>
        <tr>
            <td style="width:50%">
                <b>Place</b> &nbsp; {{ $company->letter_signatory_place ?: ($company->city ?: '—') }}<br>
                <b>Date</b> &nbsp;&nbsp; {{ now()->format('d-M-Y') }}
            </td>
            <td style="width:50%">
                (Signature of person responsible for deduction of tax)<br><br>
                <b>Full Name:</b> {{ strtoupper($company->letter_signatory_name ?: '—') }}
            </td>
        </tr>
    </table>

    <div class="spacer"></div>

    <table class="box">
        <tr class="head"><td colspan="4">2(g). Break up for ‘Amount of any other exemption under section 10’</td></tr>
        <tr class="bold">
            <td class="num">Sl.</td><td>Particulars</td><td class="amt">Gross Amount</td><td class="amt">Deductible Amount</td>
        </tr>
        @forelse ($exempt_rows as $name => $amount)
            <tr><td class="num">{{ $loop->iteration }}</td><td>{{ $name }}</td><td class="amt">{{ $rs($amount) }}</td><td class="amt">{{ $rs($amount) }}</td></tr>
        @empty
            @for ($i = 1; $i <= 3; $i++)
                <tr><td class="num">{{ $i }}</td><td>&nbsp;</td><td class="amt"></td><td class="amt"></td></tr>
            @endfor
        @endforelse
    </table>

    <div class="flag">
        <b>Part A is not attached.</b>
        Part A carries the challan details, quarterly TDS summary and certificate number, and is downloaded from the
        TRACES portal after the quarterly 24Q return has been filed and matched. This document is Part B only and is
        not a complete Form 16 on its own.
        @if ($tds_deducted > 0 || $balance != 0)
            <br><br>
            As per payroll records, TDS of Rs. {{ $rs($tds_deducted) }} was deducted for {{ $financial_year }}
            across {{ $months_paid }} month(s).
            @if ($balance > 0) Tax still payable: Rs. {{ $rs($balance) }}.
            @elseif ($balance < 0) Excess deducted: Rs. {{ $rs(abs($balance)) }}.
            @endif
        @endif
    </div>

    <div class="note">
        <b>Notes:</b>
        1. Part B (Annexure) of the certificate in Form No. 16 shall be issued by the employer.<br>
        2. If an assessee is employed under more than one employer during the year, each employer shall issue Part A
        for the period of employment with them. Part B may be issued by each employer or the last employer at the
        option of the assessee.
    </div>

</div>
</body>
</html>

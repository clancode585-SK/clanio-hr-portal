@extends('careers.layout')

@section('title', $opening->title . ' — ' . $company->name)
@section('description', $opening->summary ?: ($opening->title . ' in ' . $opening->location))

@section('head')
    <script type="application/ld+json">{!! $jsonLd !!}</script>
    <style>
        .crumb { font-size: 14px; margin: 0 0 18px; }
        .crumb a { text-decoration: none; }
        .facts {
            background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
            padding: 20px 22px; margin: 0 0 26px;
            display: grid; gap: 10px 28px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
        .fact { font-size: 15px; }
        .fact span { color: var(--ink-muted); }
        .block { margin: 0 0 26px; }
        .block h2 { font-size: 19px; margin: 0 0 10px; }
        .block ul { margin: 0; padding-left: 22px; }
        .block li { margin-bottom: 8px; color: var(--ink-muted); }
        .block li::marker { color: var(--accent); }
        .summary { color: var(--ink-muted); max-width: 75ch; }
        form {
            background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
            padding: 26px; display: grid; gap: 16px; grid-template-columns: 1fr 1fr;
        }
        form h2 { grid-column: 1 / -1; font-size: 19px; margin: 0; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field.wide { grid-column: 1 / -1; }
        label { font-size: 13px; font-weight: 600; color: var(--ink-muted); }
        label i { color: #D13B3B; font-style: normal; }
        input, textarea {
            font: inherit; font-size: 15px; color: var(--ink);
            padding: 11px 13px; border: 1px solid var(--line); border-radius: 8px;
            background: #fff; width: 100%;
        }
        input:focus, textarea:focus { outline: none; border-color: var(--accent); }
        textarea { min-height: 92px; resize: vertical; }
        input[type=file] { padding: 9px; background: var(--canvas); }
        .hint { font-size: 12px; color: var(--ink-subtle); }
        .honey { position: absolute; left: -9999px; }
        .submit { grid-column: 1 / -1; }
        .note {
            grid-column: 1 / -1; border-radius: 8px; padding: 13px 15px; font-size: 14px; display: none;
        }
        .note.bad { display: block; background: #FDECEC; border: 1px solid #D13B3B; color: #8E2020; }
        .note.good { display: block; background: #E9F7EF; border: 1px solid #1E8E5A; color: #14683F; }
        .done {
            background: var(--surface); border: 1px solid #1E8E5A; border-radius: 12px;
            padding: 34px 26px; text-align: center;
        }
        .done h2 { margin: 0 0 8px; font-size: 21px; color: #14683F; }
        .done p { margin: 0 0 6px; color: var(--ink-muted); }
        @media (max-width: 640px) {
            form { grid-template-columns: 1fr; padding: 20px; }
        }
    </style>
@endsection

@section('body')
    <p class="crumb">
        <a href="{{ route('careers.page', ['key' => $page->embed_key]) }}">Careers</a>
        <span style="color: var(--ink-subtle)"> / </span>{{ $opening->title }}
    </p>

    <h1>{{ $opening->title }}</h1>

    <div class="facts">
        <p class="fact"><span>Job Title:</span> {{ $opening->title }}</p>
        <p class="fact"><span>Location:</span> {{ $opening->location }}</p>
        <p class="fact"><span>Experience:</span> {{ $opening->experienceLabel() }}</p>
        <p class="fact"><span>Employment Type:</span> {{ ucwords(str_replace('_', '-', $opening->employment_type)) }}</p>
        @if ($opening->department)
            <p class="fact"><span>Department:</span> {{ $opening->department->name }}</p>
        @endif
        @if ($opening->positions > 1)
            <p class="fact"><span>Positions:</span> {{ $opening->positions }}</p>
        @endif
        @if ($opening->show_salary && $opening->salary_min)
            <p class="fact"><span>Salary:</span>
                ₹{{ \App\Support\Money::indian($opening->salary_min) }}@if ($opening->salary_max) – ₹{{ \App\Support\Money::indian($opening->salary_max) }}@else+ @endif
            </p>
        @endif
        @if ($opening->closes_on)
            <p class="fact"><span>Apply by:</span> {{ $opening->closes_on->format('j M Y') }}</p>
        @endif
    </div>

    @if ($opening->summary)
        <div class="block"><p class="summary">{{ $opening->summary }}</p></div>
    @endif

    @if ($opening->responsibilityList())
        <div class="block">
            <h2>Key Responsibilities:</h2>
            <ul>
                @foreach ($opening->responsibilityList() as $line)
                    <li>{{ $line }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    @if ($opening->requirementList())
        <div class="block">
            <h2>Required Skills and Qualifications:</h2>
            <ul>
                @foreach ($opening->requirementList() as $line)
                    <li>{{ $line }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    @if ($opening->niceToHaveList())
        <div class="block">
            <h2>Good to have:</h2>
            <ul>
                @foreach ($opening->niceToHaveList() as $line)
                    <li>{{ $line }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <div id="thanks" class="done" style="display: none">
        <h2>Thank you for applying</h2>
        <p>Your application for <strong>{{ $opening->title }}</strong> has reached the {{ $company->name }} team.</p>
        <p>Reference <strong id="ref"></strong></p>
    </div>

    <form id="apply" novalidate>
        <h2>Apply for this role</h2>

        <div class="note" id="note"></div>

        <div class="field">
            <label for="name">Full Name <i>*</i></label>
            <input id="name" name="name" type="text" required maxlength="150" autocomplete="name">
        </div>

        <div class="field">
            <label for="email">Email <i>*</i></label>
            <input id="email" name="email" type="email" required maxlength="200" autocomplete="email">
        </div>

        <div class="field">
            <label for="phone">Phone <i>*</i></label>
            <input id="phone" name="phone" type="tel" required maxlength="20" autocomplete="tel">
        </div>

        <div class="field">
            <label for="total_experience">Total Experience (years)</label>
            <input id="total_experience" name="total_experience" type="number" step="0.5" min="0" max="60">
        </div>

        <div class="field">
            <label for="current_company">Current Company</label>
            <input id="current_company" name="current_company" type="text" maxlength="150">
        </div>

        <div class="field">
            <label for="current_location">Current Location</label>
            <input id="current_location" name="current_location" type="text" maxlength="150">
        </div>

        <div class="field">
            <label for="current_ctc">Current CTC</label>
            <input id="current_ctc" name="current_ctc" type="number" min="0">
        </div>

        <div class="field">
            <label for="expected_ctc">Expected CTC</label>
            <input id="expected_ctc" name="expected_ctc" type="number" min="0">
        </div>

        <div class="field">
            <label for="notice_period_days">Notice Period (days)</label>
            <input id="notice_period_days" name="notice_period_days" type="number" min="0" max="365">
        </div>

        <div class="field">
            <label for="linkedin_url">LinkedIn Profile</label>
            <input id="linkedin_url" name="linkedin_url" type="url" maxlength="255" placeholder="https://linkedin.com/in/...">
        </div>

        <div class="field wide">
            <label for="resume">Resume <i>*</i></label>
            <input id="resume" name="resume" type="file" required accept=".pdf,.doc,.docx">
            <span class="hint">PDF or Word, up to 5 MB</span>
        </div>

        <div class="field wide">
            <label for="cover_note">Anything else we should know?</label>
            <textarea id="cover_note" name="cover_note" maxlength="2000"></textarea>
        </div>

        <input class="honey" tabindex="-1" autocomplete="off" name="company_website" aria-hidden="true">

        <div class="submit">
            <button class="btn" id="send" type="submit">Submit Application</button>
        </div>
    </form>

    <script>
        (function () {
            var form = document.getElementById('apply');
            var note = document.getElementById('note');
            var send = document.getElementById('send');
            var url = '{{ $apiBase }}/careers/{{ $page->embed_key }}/openings/{{ $opening->slug }}/apply';

            function fail(message) {
                note.className = 'note bad';
                note.textContent = message;
                note.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                note.className = 'note';
                note.textContent = '';

                var body = new FormData(form);
                body.append('source', 'career_page');

                send.disabled = true;
                send.textContent = 'Sending';

                fetch(url, { method: 'POST', headers: { Accept: 'application/json' }, body: body })
                    .then(function (response) {
                        return response.json().then(function (payload) {
                            return { ok: response.ok, payload: payload };
                        });
                    })
                    .then(function (result) {
                        send.disabled = false;
                        send.textContent = 'Submit Application';

                        if (!result.ok) {
                            var errors = result.payload && result.payload.errors;
                            var first = errors && Object.keys(errors).length
                                ? errors[Object.keys(errors)[0]][0]
                                : (result.payload && result.payload.message) || 'Could not send your application.';
                            fail(first);
                            return;
                        }

                        document.getElementById('ref').textContent = result.payload.data.reference;
                        document.getElementById('thanks').style.display = 'block';
                        form.style.display = 'none';
                        document.getElementById('thanks').scrollIntoView({ block: 'center', behavior: 'smooth' });
                    })
                    .catch(function () {
                        send.disabled = false;
                        send.textContent = 'Submit Application';
                        fail('Could not reach the server. Please try again.');
                    });
            });
        })();
    </script>
@endsection

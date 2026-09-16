@extends('careers.layout')

@section('title', 'Your application at ' . $company->name)
@section('description', 'Track where your application stands.')

@section('head')
    <meta name="robots" content="noindex, nofollow">
    <style>
        .hello { margin: 0 0 4px; }
        .sub { color: var(--ink-muted); margin: 0 0 28px; }
        .app {
            background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
            padding: 24px; margin-bottom: 20px;
        }
        .app h2 { font-size: 19px; margin: 0 0 4px; }
        .app .where { color: var(--ink-muted); font-size: 14px; margin: 0 0 20px; }
        .rail { display: flex; gap: 0; margin: 0 0 22px; flex-wrap: wrap; }
        .step { flex: 1 1 110px; text-align: center; position: relative; padding-top: 24px; }
        .step::before {
            content: ''; position: absolute; top: 7px; left: 0; right: 0; height: 2px; background: var(--line);
        }
        .step:first-child::before { left: 50%; }
        .step:last-child::before { right: 50%; }
        .step .dot {
            position: absolute; top: 1px; left: 50%; margin-left: -7px;
            width: 14px; height: 14px; border-radius: 50%; background: #fff;
            border: 2px solid var(--line);
        }
        .step.done::before { background: var(--accent); }
        .step.done .dot { background: var(--accent); border-color: var(--accent); }
        .step.now .dot { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(0,0,0,0.06); }
        .step span { font-size: 12px; color: var(--ink-subtle); }
        .step.done span, .step.now span { color: var(--ink); font-weight: 600; }
        .out { border-color: #D13B3B !important; }
        .rows { border-top: 1px solid var(--line); }
        .row {
            display: flex; justify-content: space-between; gap: 16px;
            padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 14px;
        }
        .row span { color: var(--ink-muted); flex-shrink: 0; }
        .row b { text-align: right; }
        .block { margin-top: 22px; }
        .block h3 { font-size: 15px; margin: 0 0 10px; }
        .round {
            background: var(--canvas); border: 1px solid var(--line); border-radius: 10px;
            padding: 14px 16px; margin-bottom: 10px;
        }
        .round p { margin: 0 0 3px; font-size: 14px; }
        .round .head { font-weight: 700; }
        .round .muted { color: var(--ink-muted); font-size: 13px; }
        .offer {
            background: #F3FAF6; border: 1px solid #1E8E5A; border-radius: 10px;
            padding: 20px; margin-top: 20px;
        }
        .offer h3 { color: #14683F; margin: 0 0 12px; }
        .offer form { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
        .offer textarea {
            flex: 1 1 100%; font: inherit; font-size: 14px; padding: 10px 12px;
            border: 1px solid var(--line); border-radius: 8px; min-height: 64px; resize: vertical;
        }
        .yes { background: #1E8E5A; }
        .no { background: transparent; color: #8E2020; border: 1px solid #D13B3B; }
        .countdown {
            background: var(--surface); border: 1px solid var(--accent); border-radius: 10px;
            padding: 20px; margin-top: 20px; text-align: center;
        }
        .countdown strong { display: block; font-size: 26px; letter-spacing: -0.5px; }
        .countdown span { color: var(--ink-muted); font-size: 14px; }
        .flash { border-radius: 8px; padding: 13px 15px; margin-bottom: 20px; font-size: 14px; }
        .flash.good { background: #E9F7EF; border: 1px solid #1E8E5A; color: #14683F; }
        .flash.bad { background: #FDECEC; border: 1px solid #D13B3B; color: #8E2020; }
        .closed { color: var(--ink-muted); font-size: 14px; }
    </style>
@endsection

@section('body')
    <h1 class="hello">Hello {{ $candidate->name }}</h1>
    <p class="sub">Here is where your application at {{ $company->name }} stands. This page is only for you.</p>

    @if (session('done'))
        <div class="flash good">{{ session('done') }}</div>
    @endif
    @if (session('problem'))
        <div class="flash bad">{{ session('problem') }}</div>
    @endif

    @forelse ($applications as $application)
        @php
            $order = array_keys($steps);
            $at = array_search($application->stage, $order, true);
            $out = in_array($application->stage, ['rejected', 'dropped'], true);
            $letter = $application->offerLetter;
            $rounds = $application->interviews->where('status', '!=', 'cancelled');
        @endphp

        <article class="app">
            <h2>{{ $application->opening?->title ?? 'Role' }}</h2>
            <p class="where">
                {{ $application->opening?->location }} ·
                applied {{ $application->created_at?->copy()->setTimezone($zone)->format('j M Y') }}
            </p>

            @if ($out)
                <p class="closed">
                    This application is closed
                    @if ($application->stage === 'rejected')
                        — we went ahead with someone else this time.
                    @else
                        — you told us you are not going ahead.
                    @endif
                </p>
            @else
                <div class="rail">
                    @foreach ($steps as $key => $label)
                        @php $index = array_search($key, $order, true); @endphp
                        <div class="step {{ $at !== false && $index < $at ? 'done' : '' }} {{ $key === $application->stage ? 'now done' : '' }}">
                            <div class="dot"></div>
                            <span>{{ $label }}</span>
                        </div>
                    @endforeach
                </div>
            @endif

            <div class="rows">
                @if ($candidate->total_experience)
                    <div class="row"><span>Your experience</span><b>{{ $candidate->total_experience }} years</b></div>
                @endif
                @if ($candidate->resume_name)
                    <div class="row"><span>Resume on file</span><b>{{ $candidate->resume_name }}</b></div>
                @endif
                <div class="row"><span>Reference</span><b>{{ $application->uuid }}</b></div>
            </div>

            @if ($rounds->isNotEmpty())
                <div class="block">
                    <h3>Your interviews</h3>
                    @foreach ($rounds as $round)
                        <div class="round">
                            <p class="head">Round {{ $round->round_no }} · {{ $round->label() }}</p>
                            <p class="muted">
                                {{ $round->scheduled_at?->copy()->setTimezone($zone)->format('D, j M Y \a\t g:i A') }}
                                ({{ $zone }}) · {{ $round->duration_minutes }} minutes
                            </p>
                            @if ($round->mode === 'in_person' && $round->location)
                                <p class="muted">At {{ $round->location }} — please carry a photo ID.</p>
                            @elseif ($round->mode === 'phone')
                                <p class="muted">We will call you on {{ $candidate->phone }}.</p>
                            @endif
                            @if ($round->meeting_url && $round->status === 'scheduled')
                                <p><a href="{{ $round->meeting_url }}">Join the video call</a></p>
                            @endif
                            @if ($round->status === 'done')
                                <p class="muted">Done — the team is reviewing.</p>
                            @endif
                        </div>
                    @endforeach
                </div>
            @endif

            @if ($letter)
                @if ($letter->isOpen() && ! $letter->hasLapsed())
                    <div class="offer">
                        <h3>You have an offer</h3>
                        <div class="rows">
                            @if ($letter->designation)
                                <div class="row"><span>Designation</span><b>{{ $letter->designation }}</b></div>
                            @endif
                            <div class="row"><span>Location</span><b>{{ $letter->location }}</b></div>
                            <div class="row"><span>Annual CTC</span><b>₹{{ \App\Support\Money::indian($letter->annual_ctc) }}</b></div>
                            <div class="row"><span>Joining date</span><b>{{ $letter->joining_date?->format('j M Y') }}</b></div>
                            @if ($letter->reporting_to)
                                <div class="row"><span>Reporting to</span><b>{{ $letter->reporting_to }}</b></div>
                            @endif
                            <div class="row"><span>Notice period</span><b>{{ $letter->notice_days }} days</b></div>
                            @if ($letter->valid_till)
                                <div class="row"><span>Please reply by</span><b>{{ $letter->valid_till->format('j M Y') }}</b></div>
                            @endif
                        </div>

                        <form method="post" action="{{ route('careers.track.answer', ['token' => $candidate->portal_token]) }}">
                            @csrf
                            <input type="hidden" name="letter" value="{{ $letter->uuid }}">
                            <textarea name="reason" placeholder="If you are turning it down, do tell us why"></textarea>
                            <button class="btn yes" type="submit" name="decision" value="accepted">I accept this offer</button>
                            <button class="btn no" type="submit" name="decision" value="declined">I am not going ahead</button>
                        </form>
                    </div>
                @elseif ($letter->status === 'accepted')
                    @php $days = (int) now()->startOfDay()->diffInDays($letter->joining_date, false); @endphp
                    <div class="countdown">
                        @if ($days > 1)
                            <strong>{{ $days }} days to go</strong>
                            <span>You join on {{ $letter->joining_date?->format('l, j F Y') }}</span>
                        @elseif ($days === 1)
                            <strong>Tomorrow</strong>
                            <span>You join on {{ $letter->joining_date?->format('l, j F Y') }}</span>
                        @elseif ($days === 0)
                            <strong>Today is the day</strong>
                            <span>Welcome to {{ $company->name }}</span>
                        @else
                            <strong>You have joined</strong>
                            <span>{{ $letter->joining_date?->format('j F Y') }}</span>
                        @endif
                    </div>
                @elseif ($letter->status === 'declined')
                    <p class="closed">You turned this offer down. Do reach out if you change your mind.</p>
                @elseif ($letter->status === 'withdrawn')
                    <p class="closed">This offer has been withdrawn. Please write to the company.</p>
                @elseif ($letter->hasLapsed())
                    <p class="closed">The reply-by date on your offer has passed. Please write to the company.</p>
                @endif
            @endif
        </article>
    @empty
        <div class="app">
            <p>We have no application on record for you yet.</p>
        </div>
    @endforelse

    @if ($company->email)
        <p class="sub">Questions? Write to <a href="mailto:{{ $company->email }}">{{ $company->email }}</a>.</p>
    @endif
@endsection

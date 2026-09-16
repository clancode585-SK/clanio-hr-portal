<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Careers at ' . $company->name)</title>
    <meta name="description" content="@yield('description', 'Current openings at ' . $company->name)">
    <style>
        :root {
            --accent: {{ $page?->accent_color ?? "#1B2A6B" }};
            --ink: #10162B;
            --ink-muted: #5A6478;
            --ink-subtle: #8B95AC;
            --line: #E3E7EF;
            --surface: #FFFFFF;
            --canvas: #F5F7FB;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: var(--canvas);
            color: var(--ink);
            font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        a { color: var(--accent); }
        .wrap { max-width: 1040px; margin: 0 auto; padding: 32px 20px 64px; }
        .top {
            display: flex; align-items: center; gap: 14px;
            padding: 18px 20px; background: var(--surface); border-bottom: 1px solid var(--line);
        }
        .top img { height: 34px; width: auto; }
        .top strong { font-size: 17px; }
        .top a { margin-left: auto; font-size: 14px; text-decoration: none; }
        h1 { font-size: 30px; line-height: 1.25; margin: 0 0 8px; letter-spacing: -0.5px; }
        .intro { color: var(--ink-muted); max-width: 70ch; margin: 0 0 28px; }
        .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); }
        .card {
            background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
            padding: 22px; display: flex; flex-direction: column; gap: 10px;
        }
        .card h2 { font-size: 18px; margin: 0; line-height: 1.35; }
        .card h2 a { text-decoration: none; color: var(--ink); }
        .card h2 a:hover { color: var(--accent); }
        .meta { color: var(--ink-muted); font-size: 14px; margin: 0; }
        .meta b { color: var(--ink); font-weight: 600; }
        .tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag {
            font-size: 12px; font-weight: 600; color: var(--ink-muted);
            background: var(--canvas); border: 1px solid var(--line);
            padding: 3px 9px; border-radius: 999px; text-transform: capitalize;
        }
        .btn {
            display: inline-block; background: var(--accent); color: #fff;
            padding: 11px 20px; border-radius: 8px; font-size: 14px; font-weight: 700;
            text-decoration: none; border: 0; cursor: pointer; text-align: center;
        }
        .btn:hover { filter: brightness(1.1); }
        .btn.ghost { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
        .card .btn { margin-top: auto; align-self: flex-start; }
        .empty {
            background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
            padding: 44px 24px; text-align: center; color: var(--ink-muted);
        }
        .foot { margin-top: 48px; text-align: center; color: var(--ink-subtle); font-size: 13px; }
        .foot a { color: var(--ink-subtle); }
        @media (max-width: 560px) {
            h1 { font-size: 24px; }
            .wrap { padding: 22px 16px 48px; }
        }
    </style>
    @yield('head')
</head>
<body>
<header class="top">
    @if ($company->logo_url)
        <img src="{{ $company->logo_url }}" alt="{{ $company->name }}">
    @endif
    <strong>{{ $company->name }}</strong>
    @if ($company->website)
        <a href="{{ $company->website }}">Visit website</a>
    @endif
</header>

<main class="wrap">
    @yield('body')

    @if ($page?->show_powered_by ?? true)
        <p class="foot">Hiring runs on <a href="https://claniohrportal.com">Clanio</a></p>
    @endif
</main>
</body>
</html>

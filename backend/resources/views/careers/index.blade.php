@extends('careers.layout')

@section('body')
    <h1>{{ $page->headline ?: 'Current Openings' }}</h1>

    @if ($page->intro)
        <p class="intro">{{ $page->intro }}</p>
    @endif

    @if ($openings->isEmpty())
        <div class="empty">
            <p>No openings are listed right now.</p>
            <p>Do check back, or write to us at
                <a href="mailto:{{ $company->email }}">{{ $company->email }}</a>.</p>
        </div>
    @else
        <div class="grid">
            @foreach ($openings as $opening)
                <article class="card">
                    <h2>
                        <a href="{{ route('careers.opening', ['key' => $page->embed_key, 'slug' => $opening->slug]) }}">
                            {{ $opening->title }}
                        </a>
                    </h2>

                    <p class="meta"><b>Experience</b> — {{ $opening->experienceLabel() }}</p>
                    <p class="meta"><b>Location</b> — {{ $opening->location }}</p>

                    <div class="tags">
                        <span class="tag">{{ str_replace('_', ' ', $opening->employment_type) }}</span>
                        <span class="tag">{{ $opening->work_mode }}</span>
                        @if ($opening->department)
                            <span class="tag">{{ $opening->department->name }}</span>
                        @endif
                        @if ($opening->positions > 1)
                            <span class="tag">{{ $opening->positions }} positions</span>
                        @endif
                    </div>

                    <a class="btn"
                       href="{{ route('careers.opening', ['key' => $page->embed_key, 'slug' => $opening->slug]) }}">
                        Apply Now
                    </a>
                </article>
            @endforeach
        </div>
    @endif
@endsection

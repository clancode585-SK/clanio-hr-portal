<?xml version="1.0" encoding="utf-8"?>
<source>
    <publisher>{{ $company->name }}</publisher>
    @if ($company->website)
        <publisherurl>{{ $company->website }}</publisherurl>
    @endif
    <lastBuildDate>{{ now()->toRfc2822String() }}</lastBuildDate>
    @foreach ($openings as $opening)
        <job>
            <title><![CDATA[{{ $opening->title }}]]></title>
            <date><![CDATA[{{ $opening->published_at?->toRfc2822String() }}]]></date>
            <referencenumber><![CDATA[{{ $opening->uuid }}]]></referencenumber>
            <url><![CDATA[{{ $link($opening) }}]]></url>
            <company><![CDATA[{{ $company->name }}]]></company>
            <city><![CDATA[{{ $opening->location }}]]></city>
            <state><![CDATA[{{ $company->state }}]]></state>
            <country><![CDATA[{{ $company->country ?: 'India' }}]]></country>
            <jobtype><![CDATA[{{ str_replace('_', ' ', $opening->employment_type) }}]]></jobtype>
            @if ($opening->department)
                <category><![CDATA[{{ $opening->department->name }}]]></category>
            @endif
            <experience><![CDATA[{{ $opening->experienceLabel() }}]]></experience>
            @if ($opening->show_salary && $opening->salary_min)
                <salary><![CDATA[{{ $opening->salary_min }}{{ $opening->salary_max ? ' - ' . $opening->salary_max : '+' }} INR per year]]></salary>
            @endif
            @if ($opening->work_mode === 'remote')
                <remotetype><![CDATA[Fully remote]]></remotetype>
            @endif
            <description><![CDATA[
                @if ($opening->summary)<p>{{ $opening->summary }}</p>@endif
                @if ($opening->responsibilityList())
                    <h3>Key Responsibilities</h3>
                    <ul>@foreach ($opening->responsibilityList() as $line)<li>{{ $line }}</li>@endforeach</ul>
                @endif
                @if ($opening->requirementList())
                    <h3>Required Skills and Qualifications</h3>
                    <ul>@foreach ($opening->requirementList() as $line)<li>{{ $line }}</li>@endforeach</ul>
                @endif
                @if ($opening->niceToHaveList())
                    <h3>Good to have</h3>
                    <ul>@foreach ($opening->niceToHaveList() as $line)<li>{{ $line }}</li>@endforeach</ul>
                @endif
            ]]></description>
        </job>
    @endforeach
</source>

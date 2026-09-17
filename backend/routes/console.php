<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schedule;

Schedule::command('work:reminders --type=tasks')->dailyAt('09:00')->withoutOverlapping();
Schedule::command('work:reminders --type=sod')->dailyAt('11:00')->weekdays()->withoutOverlapping();
Schedule::command('work:reminders --type=eod')->dailyAt('20:00')->weekdays()->withoutOverlapping();

Schedule::command('attendance:auto-checkout')->dailyAt('23:55')->withoutOverlapping();
Schedule::command('attendance:auto-checkout --stale-only')->dailyAt('06:00')->withoutOverlapping();

Schedule::command('documents:expiry-alerts')->dailyAt('10:00')->withoutOverlapping();

Schedule::command('exits:process')->dailyAt('00:30')->withoutOverlapping();

Schedule::command('performance:snapshot')->monthlyOn(1, '01:00')->withoutOverlapping();

Schedule::command('policy:reminders')->weeklyOn(1, '10:30')->withoutOverlapping();

Schedule::command('profile:reminders')->dailyAt('11:30')->weekdays()->withoutOverlapping();

Schedule::command('salary:disburse')->everyFifteenMinutes()->withoutOverlapping();

Schedule::command('tickets:escalate')->hourly()->withoutOverlapping();

Schedule::command('leave:accrue')->monthlyOn(1, '02:00')->withoutOverlapping();
Schedule::command('leave:accrue --carry-forward')->yearlyOn(1, 1, '03:00')->withoutOverlapping();

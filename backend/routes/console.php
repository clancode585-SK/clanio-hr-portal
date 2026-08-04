<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schedule;

// reminders
Schedule::command('work:reminders --type=tasks')->dailyAt('09:00')->withoutOverlapping();
Schedule::command('work:reminders --type=sod')->dailyAt('11:00')->weekdays()->withoutOverlapping();
Schedule::command('work:reminders --type=eod')->dailyAt('20:00')->weekdays()->withoutOverlapping();

// bhooli hui check-out band karo — warna agle din check-in atak jayega
Schedule::command('attendance:auto-checkout')->dailyAt('23:55')->withoutOverlapping();
Schedule::command('attendance:auto-checkout --stale-only')->dailyAt('06:00')->withoutOverlapping();

// documents expire hone se pehle alert
Schedule::command('documents:expiry-alerts')->dailyAt('10:00')->withoutOverlapping();

// leave balance
Schedule::command('leave:accrue')->monthlyOn(1, '02:00')->withoutOverlapping();
Schedule::command('leave:accrue --carry-forward')->yearlyOn(1, 1, '03:00')->withoutOverlapping();

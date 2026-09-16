<?php

declare(strict_types=1);

use App\Http\Controllers\Public\CandidatePortalController;
use App\Http\Controllers\Public\CareerPageWebController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('welcome'));

Route::get('embed.js', [CareerPageWebController::class, 'embed'])->name('careers.embed');

Route::middleware('throttle:careers')->group(function (): void {
    Route::get('track/{token}', [CandidatePortalController::class, 'show'])->name('careers.track');
    Route::post('track/{token}', [CandidatePortalController::class, 'answer'])->name('careers.track.answer');

    Route::get('careers/{key}', [CareerPageWebController::class, 'index'])->name('careers.page');
    Route::get('careers/{key}/feed.xml', [CareerPageWebController::class, 'feed'])->name('careers.feed');
    Route::get('careers/{key}/{slug}', [CareerPageWebController::class, 'opening'])->name('careers.opening');
});

<?php

use App\Http\Controllers\MapController;
use App\Http\Controllers\PartyController;
use App\Http\Middleware\MarkPublicPage;
use Illuminate\Support\Facades\Route;

Route::middleware(MarkPublicPage::class)->group(function () {
    Route::get('/', [MapController::class, 'home'])->name('map.home');
    Route::get('/{level}/{code}', [MapController::class, 'unit'])
        ->where(['level' => 'county|constituency|ward', 'code' => '[0-9]+'])
        ->name('map.unit');
    Route::get('/party/{abbrev}', [PartyController::class, 'show'])
        ->where('abbrev', '[A-Za-z0-9]+(-[A-Za-z0-9]+)*')
        ->name('map.party');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'Dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';

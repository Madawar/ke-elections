<?php

use App\Http\Controllers\MapController;
use Illuminate\Support\Facades\Route;

Route::get('/', [MapController::class, 'home'])->name('map.home');
Route::get('/{level}/{code}', [MapController::class, 'unit'])
    ->where(['level' => 'county|constituency|ward', 'code' => '[0-9]+'])
    ->name('map.unit');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'Dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';

<?php

use App\Http\Controllers\Data\SeatsController;
use Illuminate\Support\Facades\Route;

/*
| Public, read-only data for the map. Registered in bootstrap/app.php outside the
| `web` group: no session, no cookies, so responses can be cached by browsers and CDNs.
*/

Route::get('/data/seats.json', SeatsController::class)
    ->middleware('cache.headers:public;max_age=300;etag')
    ->name('data.seats');

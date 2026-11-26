<?php

use App\Models\User;

test('the page links the web app manifest, theme colour and touch icon', function () {
    $html = $this->get('/')->assertOk()->getContent();

    expect($html)
        ->toContain('<link rel="manifest" href="/manifest.webmanifest">')
        ->toContain('<meta name="theme-color"')
        ->toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-180.png">');
});

test('an explicit dark appearance gets the dark theme colour only', function () {
    $html = $this->withUnencryptedCookie('appearance', 'dark')->get('/')->assertOk()->getContent();

    expect($html)
        ->toContain('<meta name="theme-color" content="#0F2430">')
        ->not->toContain('content="#EEF1EF"');
});

test('map pages are marked safe to keep offline only for signed-out visitors', function () {
    $this->get('/ward/1448')->assertOk()->assertHeader('X-Public-Page', '1');
    $this->get('/')->assertHeader('X-Public-Page', '1');

    $user = User::factory()->create();
    $this->actingAs($user)->get('/ward/1448')->assertOk()->assertHeaderMissing('X-Public-Page');
});

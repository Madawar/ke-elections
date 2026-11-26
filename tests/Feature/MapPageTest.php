<?php

use Inertia\Testing\AssertableInertia as Assert;

test('the home page renders the map', function () {
    $this->get('/')->assertOk()
        ->assertSee('<title>Kenya Electoral Map</title>', false)
        ->assertInertia(fn (Assert $page) => $page->component('Map')->where('unit', null));
});

test('a ward deep link renders its title, Open Graph url and unit', function () {
    $response = $this->get('/ward/1448')->assertOk();
    $response->assertSee('<title>Ngei Ward — Kenya Electoral Map</title>', false);
    expect($response->getContent())->toMatch('#<meta property="og:url" content="[^"]*/ward/1448">#');
    $response->assertInertia(fn (Assert $page) => $page->component('Map')->where('unit.code', 1448)->where('unit.ancestors.0.name', 'Mathare'));
});

test('og:url and canonical come from the app url, not the Host header', function () {
    config(['app.url' => 'https://map.example.test']);

    $content = $this->withHeader('Host', 'evil.example')->get('http://evil.example/ward/1448')->assertOk()->getContent();

    expect($content)->not->toMatch('#og:url" content="[^"]*evil\.example#')
        ->not->toMatch('#canonical" href="[^"]*evil\.example#')
        ->toContain('<meta property="og:url" content="https://map.example.test/ward/1448">')
        ->toContain('<link rel="canonical" href="https://map.example.test/ward/1448">');

    expect($this->get('http://evil.example/')->getContent())
        ->toContain('<meta property="og:url" content="https://map.example.test/">');
});

test('wards with the same name get different descriptions', function () {
    $this->get('/ward/713')->assertOk()->assertSee('Huruma ward, Turbo constituency', false);
    $this->get('/ward/1447')->assertOk()->assertSee('Huruma ward, Mathare constituency', false);
});

test('punctuation in names is escaped', function () {
    $this->get('/ward/737')->assertOk()->assertSee('Cherang&#039;any/Chebororwa', false);
});

test('bad deep links give 404', function (string $path) {
    $this->get($path)->assertNotFound();
})->with(['/ward/0', '/ward/1451', '/county/48', '/ward/abc', '/province/1', '/ward/0012']);

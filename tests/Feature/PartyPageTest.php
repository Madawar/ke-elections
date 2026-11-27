<?php

use App\Models\Party;
use App\Models\PartyAlias;
use App\Support\PartyDirectory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Inertia\Testing\AssertableInertia as Assert;

// Parties in tests/Fixtures/import are fictional sample data.

uses(RefreshDatabase::class);

beforeEach(function () {
    Artisan::call('data:import', ['kind' => 'parties', 'file' => base_path('tests/Fixtures/import/parties.csv')]);
});

test('a party deep link renders its title, Open Graph tags and party', function () {
    $response = $this->get('/party/spa')->assertOk();

    $response->assertSee('<title>Sample Party A (SPA) — Kenya Electoral Map</title>', false);
    expect($response->getContent())
        ->toMatch('#<meta property="og:url" content="[^"]*/party/spa">#')
        ->toContain('<meta property="og:title" content="Sample Party A (SPA) — Kenya Electoral Map">')
        ->toContain('<meta name="description" content="Seats held by Sample Party A (SPA): governors, senators, woman reps, MPs and MCAs, with sources.">')
        ->toMatch('#<link rel="canonical" href="[^"]*/party/spa">#');
    $response->assertInertia(fn (Assert $page) => $page->component('Map')
        ->where('unit', null)
        ->where('party.abbrev', 'SPA')
        ->where('party.name', 'Sample Party A'));
});

test('the abbreviation in the address is not case sensitive and the canonical link is lower case', function () {
    $this->get('/party/SPA')->assertOk()
        ->assertSee('<link rel="canonical" href="'.rtrim((string) config('app.url'), '/').'/party/spa">', false);
});

test('abbreviations with a hyphen work', function () {
    Party::create(['abbrev' => 'XY-Z', 'name' => 'Hyphen Sample', 'status' => 'fully registered', 'source_url' => 'https://example.org']);

    $this->get('/party/xy-z')->assertOk()->assertInertia(fn (Assert $page) => $page->where('party.abbrev', 'XY-Z'));
});

test('an unknown party, the independents and a bad abbreviation give 404', function (string $path) {
    $this->get($path)->assertNotFound();
})->with(['/party/nope', '/party/ind', '/party/IND', '/party/', '/party/a_b', '/party/spa/extra', '/party/-']);

test('the page is marked public for the offline cache', function () {
    expect($this->get('/party/spa')->headers->get('X-Public-Page'))->toBe('1');
});

test('og:url comes from the app url, not the Host header', function () {
    config(['app.url' => 'https://map.example.test']);

    $content = $this->withHeader('Host', 'evil.example')->get('http://evil.example/party/spa')->assertOk()->getContent();

    expect($content)->toContain('<meta property="og:url" content="https://map.example.test/party/spa">')
        ->toContain('<link rel="canonical" href="https://map.example.test/party/spa">')
        ->not->toMatch('#og:url" content="[^"]*evil\.example#');
});

test('punctuation in a party name is escaped', function () {
    Party::create(['abbrev' => 'QQ', 'name' => 'Quill & "Co" <b>', 'status' => 'fully registered', 'source_url' => 'https://example.org']);

    $content = $this->get('/party/qq')->assertOk()->getContent();

    expect($content)->toContain('Quill &amp; &quot;Co&quot; &lt;b&gt; (QQ)')->not->toContain('<b> (QQ)');
});

test('PartyDirectory finds a party by its abbreviation in any case, and never the independents', function () {
    $directory = new PartyDirectory;

    expect($directory->find('spb')?->abbrev)->toBe('SPB')
        ->and($directory->find('SPB')?->abbrev)->toBe('SPB')
        ->and($directory->find('osp'))->toBeNull()
        ->and($directory->find('ind'))->toBeNull()
        ->and($directory->find('missing'))->toBeNull();
});

test('the seats data carries what a party profile shows: status, source and former names', function () {
    $json = $this->getJson('/data/seats.json')->assertOk()->json('parties');

    $spb = collect($json)->firstWhere('abbrev', 'SPB');
    expect($spb)->toMatchArray([
        'status' => 'fully registered',
        'source_url' => 'https://example.org/orpp/register',
        'former_names' => [['abbrev' => 'OSP', 'effective_on' => '2024-03-01']],
    ]);
    expect(collect($json)->firstWhere('abbrev', 'SPA')['former_names'])->toBe([]);
    expect(PartyAlias::count())->toBe(1);
});

test('a county scope is in the title, the description and the canonical link', function () {
    $response = $this->get('/party/spa?in=county-47')->assertOk();

    $response->assertSee('<title>Sample Party A (SPA) in Nairobi City — Kenya Electoral Map</title>', false);
    expect($response->getContent())
        ->toContain('Seats held by Sample Party A (SPA) in Nairobi City: governor, senator, woman rep, MPs and MCAs, with sources.')
        ->toMatch('#<meta property="og:url" content="[^"]*/party/spa\?in=county-47">#')
        ->toMatch('#<link rel="canonical" href="[^"]*/party/spa\?in=county-47">#');
});

test('a constituency scope names the constituency', function () {
    $this->get('/party/spa?in=constituency-290')->assertOk()
        ->assertSee('<title>Sample Party A (SPA) in Mathare — Kenya Electoral Map</title>', false);
});

test('a scope that is not a county or constituency of ours is all of Kenya, not an error', function (string $query) {
    $response = $this->get('/party/spa'.$query)->assertOk();
    $response->assertSee('<title>Sample Party A (SPA) — Kenya Electoral Map</title>', false);
    expect($response->getContent())->toMatch('#<meta property="og:url" content="[^"]*/party/spa">#');
})->with(['?in=county-999', '?in=ward-1', '?in=county-047', '?in=nonsense', '?in=', '?in[]=county-1']);

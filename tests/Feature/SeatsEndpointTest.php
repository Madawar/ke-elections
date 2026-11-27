<?php

use App\Models\OfficeHolder;
use Database\Seeders\UnitsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

// All people and parties in tests/Fixtures/import are fictional sample data.

uses(RefreshDatabase::class);

test('an empty database returns valid JSON with empty collections', function () {
    $response = $this->getJson('/data/seats.json');

    $response->assertOk()
        ->assertHeader('Content-Type', 'application/json')
        ->assertJsonPath('as_of', null)
        ->assertJsonPath('data_as_of', null)
        ->assertJsonPath('parties', [])
        ->assertJsonPath('holders', []);

    $json = json_decode($response->getContent());
    expect($json->totals)->toBeObject()
        ->and($json->chambers->national_assembly)->toBeObject()
        ->and((array) $json->chambers->national_assembly)->toBe([])
        ->and($json->chambers->senate)->toBeObject();
});

test('is public and cacheable', function () {
    $response = $this->get('/data/seats.json');

    $response->assertOk();
    expect($response->headers->get('Cache-Control'))->toContain('public')
        ->toContain('max-age=')
        ->and($response->headers->get('ETag'))->not->toBeNull()
        ->and($response->headers->get('Set-Cookie'))->toBeNull();
});

test('serves current holders, parties, seat totals and chamber counts', function () {
    $this->seed(UnitsSeeder::class);
    Artisan::call('data:import', [
        'kind' => 'parties',
        'file' => base_path('tests/Fixtures/import/parties.csv'),
        '--colours' => base_path('tests/Fixtures/import/party_colours.csv'),
    ]);
    Artisan::call('data:import', ['kind' => 'holders', 'file' => base_path('tests/Fixtures/import/holders_valid.csv')]);

    $response = $this->getJson('/data/seats.json')->assertOk();
    $json = $response->json();

    // as_of = when it was imported; data_as_of = the latest date the data describes
    // (Sample Holder Seven's by-election start, after Six's 2024-01-15 end).
    expect($json['as_of'])->toBe(now()->toDateString())
        ->and($json['data_as_of'])->toBe('2024-03-01')
        ->and($json['holders'])->toHaveCount(10)
        ->and(collect($json['holders'])->pluck('name'))->not->toContain('Sample Holder Six');

    expect($json['parties'])->toContain(
        ['abbrev' => 'SPA', 'name' => 'Sample Party A', 'coalition_2022' => 'Sample Coalition One', 'colour' => '#aa3344', 'status' => 'fully registered', 'source_url' => 'https://example.org/orpp/register', 'former_names' => []],
        ['abbrev' => 'SPC', 'name' => 'Sample Party C', 'coalition_2022' => null, 'colour' => null, 'status' => 'deregistered', 'source_url' => 'https://example.org/orpp/register', 'former_names' => []],
    );

    $governor = collect($json['holders'])->firstWhere('seat', 'governor');
    expect($governor)->toBe([
        'seat' => 'governor',
        'level' => 'county',
        'code' => 1,
        'name' => 'Sample Holder One',
        'party' => 'SPA',
        'basis' => 'elected',
        'started_on' => '2022-08-25',
        'source_url' => 'https://example.org/gazette/2022/9773',
        'confidence' => 'high',
    ]);

    expect(collect($json['holders'])->firstWhere('name', 'Sample Holder Five')['party'])->toBe('IND');

    expect($json['totals']['mp'])->toEqual(['SPA' => 2, 'IND' => 1])
        ->and($json['totals']['senator'])->toEqual(['SPB' => 1])
        ->and($json['totals']['nominated_mca'])->toEqual(['SPA' => 1]);

    expect($json['chambers']['national_assembly'])->toEqual(['SPA' => 3, 'SPB' => 1, 'IND' => 1])
        ->and($json['chambers']['senate'])->toEqual(['SPB' => 2]);
});

test('data_as_of is the latest started_on or ended_on among holders', function () {
    $this->seed(UnitsSeeder::class);
    Artisan::call('data:import', ['kind' => 'parties', 'file' => base_path('tests/Fixtures/import/parties.csv')]);
    Artisan::call('data:import', ['kind' => 'holders', 'file' => base_path('tests/Fixtures/import/holders_valid.csv')]);
    OfficeHolder::where('holder_name', 'Sample Holder One')->update(['ended_on' => '2025-06-30']);

    expect($this->getJson('/data/seats.json')->json('data_as_of'))->toBe('2025-06-30');
});

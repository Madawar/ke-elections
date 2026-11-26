<?php

use App\Models\Audit;
use App\Models\ImportBatch;
use App\Models\Nomination;
use App\Models\OfficeHolder;
use App\Models\Party;
use App\Models\PartyAlias;
use App\Models\Unit;
use Database\Seeders\UnitsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

// All people and parties in tests/Fixtures/import are fictional sample data.

uses(RefreshDatabase::class);

function importFixture(string $name): string
{
    return base_path('tests/Fixtures/import/'.$name);
}

/** @return array{0:int,1:string} exit code and output */
function runImport(string $kind, string $file, array $options = []): array
{
    if ($kind === 'parties' && ! array_key_exists('--colours', $options)) {
        $options['--colours'] = importFixture('party_colours.csv');
    }

    $code = Artisan::call('data:import', ['kind' => $kind, 'file' => importFixture($file)] + $options);

    return [$code, Artisan::output()];
}

beforeEach(function () {
    $this->seed(UnitsSeeder::class);
});

describe('units seeder', function () {
    test('seeds every IEBC unit with its parent codes', function () {
        expect(Unit::where('level', 'province')->count())->toBe(8)
            ->and(Unit::where('level', 'county')->count())->toBe(47)
            ->and(Unit::where('level', 'constituency')->count())->toBe(290)
            ->and(Unit::where('level', 'ward')->count())->toBe(1450);

        $ward = Unit::where('level', 'ward')->where('code', 1448)->first();
        expect($ward->name)->toBe('Ngei')
            ->and($ward->parent_level)->toBe('constituency')
            ->and($ward->parent_code)->toBe(290);

        $nairobi = Unit::where('level', 'county')->where('code', 47)->first();
        expect($nairobi->name)->toBe('Nairobi City')
            ->and($nairobi->parent_level)->toBe('province')
            ->and($nairobi->parent_code)->toBe(8);
    });

    test('is idempotent', function () {
        $this->seed(UnitsSeeder::class);
        expect(Unit::count())->toBe(8 + 47 + 290 + 1450);
    });
});

describe('parties import', function () {
    test('imports parties, aliases and display colours', function () {
        [$code, $out] = runImport('parties', 'parties.csv');

        expect($code)->toBe(0, $out)
            ->and(Party::count())->toBe(3);

        $spb = Party::where('abbrev', 'SPB')->first();
        expect($spb->display_colour)->toBe('#3355aa')
            ->and($spb->coalition_2022)->toBe('Sample Coalition Two')
            ->and(Party::where('abbrev', 'SPC')->first()->display_colour)->toBeNull();

        $alias = PartyAlias::where('alias', 'OSP')->first();
        expect($alias->party_id)->toBe($spb->id)
            ->and($alias->effective_on->toDateString())->toBe('2024-03-01');

        expect(ImportBatch::where('kind', 'parties')->count())->toBe(1)
            ->and(Audit::where('auditable_type', 'party')->count())->toBe(3)
            ->and(Audit::where('auditable_type', 'party_alias')->count())->toBe(1);
    });

    test('leaves colours null when there is no colours file', function () {
        [$code] = runImport('parties', 'parties.csv', ['--colours' => importFixture('does-not-exist.csv')]);

        expect($code)->toBe(0)
            ->and(Party::whereNotNull('display_colour')->count())->toBe(0);
    });
});

describe('holders import', function () {
    beforeEach(function () {
        runImport('parties', 'parties.csv');
    });

    test('happy path imports every row, resolves aliases and independents, and audits', function () {
        [$code, $out] = runImport('holders', 'holders_valid.csv');

        expect($code)->toBe(0, $out)
            ->and($out)->not->toContain('WARNING')
            ->and(OfficeHolder::count())->toBe(11)
            ->and(OfficeHolder::whereNull('ended_on')->count())->toBe(10);

        $senator = OfficeHolder::where('seat', 'senator')->first();
        expect($senator->party->abbrev)->toBe('SPB')
            ->and($senator->unit_code)->toBe(1)
            ->and($senator->source_url)->toBe('https://example.org/gazette/2022/9773');

        expect(OfficeHolder::where('holder_name', 'Sample Holder Five')->first()->party_id)->toBeNull();

        $batch = ImportBatch::where('kind', 'holders')->sole();
        expect($batch->row_count)->toBe(11)
            ->and($batch->sha256)->toBe(hash_file('sha256', importFixture('holders_valid.csv')))
            ->and(OfficeHolder::where('import_batch_id', $batch->id)->count())->toBe(11)
            ->and(Audit::where('auditable_type', 'office_holder')->where('event', 'created')->count())->toBe(11)
            ->and(Audit::where('import_batch_id', $batch->id)->count())->toBe(11);
    });

    test('rejects an unknown unit code with its line number and imports nothing', function () {
        [$code, $out] = runImport('holders', 'holders_bad_unit.csv');

        expect($code)->toBe(1)
            ->and($out)->toContain('Line 3:')
            ->and($out)->toContain('constituency 291')
            ->and($out)->toContain('Line 4:')
            ->and($out)->toContain('ward 9999')
            ->and($out)->not->toContain('Line 2:')
            ->and(OfficeHolder::count())->toBe(0)
            ->and(ImportBatch::where('kind', 'holders')->count())->toBe(0);
    });

    test('rejects a seat on the wrong level', function () {
        [$code, $out] = runImport('holders', 'holders_seat_level_mismatch.csv');

        expect($code)->toBe(1)
            ->and($out)->toContain('Line 2:')
            ->and($out)->toContain('governor')
            ->and($out)->toContain('Line 3:')
            ->and(OfficeHolder::count())->toBe(0);
    });

    test('rejects an unknown party', function () {
        [$code, $out] = runImport('holders', 'holders_unknown_party.csv');

        expect($code)->toBe(1)
            ->and($out)->toContain('Line 3:')
            ->and($out)->toContain('NOPE')
            ->and(OfficeHolder::count())->toBe(0);
    });

    test('rejects a missing or non-http source', function () {
        [$code, $out] = runImport('holders', 'holders_missing_source.csv');

        expect($code)->toBe(1)
            ->and($out)->toContain('Line 2:')
            ->and($out)->toContain('Line 3:')
            ->and($out)->toContain('source_url')
            ->and(OfficeHolder::count())->toBe(0);
    });

    test('rejects two current holders for one seat', function () {
        [$code, $out] = runImport('holders', 'holders_two_current.csv');

        expect($code)->toBe(1)
            ->and($out)->toContain('Line 3:')
            ->and($out)->toContain('current holder')
            ->and(OfficeHolder::count())->toBe(0);
    });

    test('rejects a new current holder when the database already has one for that seat', function () {
        runImport('holders', 'holders_valid.csv');
        [$code, $out] = runImport('holders', 'holders_by_election.csv');

        expect($code)->toBe(1)
            ->and($out)->toContain('Line 2:')
            ->and($out)->toContain('Sample Holder One')
            ->and(OfficeHolder::count())->toBe(11);
    });

    test('rejects bad dates and duplicate rows', function () {
        [$code, $out] = runImport('holders', 'holders_bad_dates.csv');

        expect($code)->toBe(1)
            ->and($out)->toContain('Line 2:')
            ->and($out)->toContain('started_on')
            ->and($out)->toContain('Line 3:')
            ->and($out)->toContain('ended_on')
            ->and($out)->toContain('Line 4:')
            ->and($out)->toContain('duplicate')
            ->and(OfficeHolder::count())->toBe(0);
    });

    test('accepts succession for governors only', function () {
        [$code, $out] = runImport('holders', 'holders_succession.csv');

        expect($code)->toBe(1)
            ->and($out)->not->toContain('Line 3:')
            ->and($out)->toContain('Line 4:')
            ->and($out)->toContain('succession');
    });

    test('warns, but still imports, when the unit name in the source does not match', function () {
        [$code, $out] = runImport('holders', 'holders_name_warning.csv');

        expect($code)->toBe(0)
            ->and($out)->toContain('WARNING')
            ->and($out)->toContain('Line 2:')
            ->and($out)->toContain('Kisumu')
            ->and(OfficeHolder::count())->toBe(1);
    });

    test('dry run validates but writes nothing', function () {
        $audits = Audit::count();
        $batches = ImportBatch::count();

        [$code, $out] = runImport('holders', 'holders_valid.csv', ['--dry-run' => true]);

        expect($code)->toBe(0, $out)
            ->and($out)->toContain('Dry run')
            ->and($out)->toContain('11 to create')
            ->and(OfficeHolder::count())->toBe(0)
            ->and(Audit::count())->toBe($audits)
            ->and(ImportBatch::count())->toBe($batches);
    });

    test('dry run still reports errors and fails', function () {
        [$code, $out] = runImport('holders', 'holders_bad_unit.csv', ['--dry-run' => true]);

        expect($code)->toBe(1)->and($out)->toContain('Line 3:');
    });

    test('re-importing the same file is idempotent', function () {
        runImport('holders', 'holders_valid.csv');
        $audits = Audit::count();
        $ids = OfficeHolder::orderBy('id')->pluck('id')->all();

        [$code, $out] = runImport('holders', 'holders_valid.csv');

        expect($code)->toBe(0, $out)
            ->and($out)->toContain('11 unchanged')
            ->and(OfficeHolder::orderBy('id')->pluck('id')->all())->toBe($ids)
            ->and(Audit::count())->toBe($audits);
    });

    test('a changed row updates in place and audits old and new values', function () {
        runImport('holders', 'holders_valid.csv');
        $holder = OfficeHolder::where('holder_name', 'Sample Holder One')->first();

        $changed = str_replace(
            'Sample Holder One,SPA,Sample Party A,elected,2022-08-25,,high',
            'Sample Holder One,SPA,Sample Party A,elected,2022-08-25,2024-12-31,medium',
            file_get_contents(importFixture('holders_valid.csv')),
        );
        $path = tempnam(sys_get_temp_dir(), 'holders').'.csv';
        file_put_contents($path, $changed);

        $code = Artisan::call('data:import', ['kind' => 'holders', 'file' => $path]);
        @unlink($path);

        $audit = Audit::where('auditable_type', 'office_holder')
            ->where('auditable_id', $holder->id)->where('event', 'updated')->sole();

        expect($code)->toBe(0, Artisan::output())
            ->and(OfficeHolder::count())->toBe(11)
            ->and($holder->fresh()->ended_on->toDateString())->toBe('2024-12-31')
            ->and($audit->old['confidence'])->toBe('high')
            ->and($audit->new['confidence'])->toBe('medium')
            ->and($audit->new['ended_on'])->toBe('2024-12-31');
    });

    test('rejects an unknown kind and missing headers', function () {
        expect(Artisan::call('data:import', ['kind' => 'people', 'file' => importFixture('holders_valid.csv')]))->toBe(1);

        [$code, $out] = runImport('holders', 'nominations_valid.csv');
        expect($code)->toBe(1)->and($out)->toContain('header');
    });
});

describe('nominations import', function () {
    beforeEach(function () {
        runImport('parties', 'parties.csv');
    });

    test('imports nominations through the same path', function () {
        [$code, $out] = runImport('nominations', 'nominations_valid.csv');

        expect($code)->toBe(0, $out)
            ->and(Nomination::count())->toBe(4)
            ->and(Nomination::where('candidate_name', 'Sample Candidate Two')->first()->party->abbrev)->toBe('SPB')
            ->and(Nomination::where('candidate_name', 'Sample Candidate Three')->first()->party_id)->toBeNull()
            ->and(Audit::where('auditable_type', 'nomination')->count())->toBe(4);

        [$code, $out] = runImport('nominations', 'nominations_valid.csv');
        expect($code)->toBe(0)
            ->and($out)->toContain('4 unchanged')
            ->and(Nomination::count())->toBe(4);
    });

    test('rejects bad units, bad statuses and two winners for one seat', function () {
        [$code, $out] = runImport('nominations', 'nominations_invalid.csv');

        expect($code)->toBe(1)
            ->and($out)->toContain('Line 2:')
            ->and($out)->toContain('Line 3:')
            ->and($out)->toContain('status')
            ->and($out)->toContain('Line 5:')
            ->and(Nomination::count())->toBe(0);
    });
});

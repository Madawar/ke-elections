<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds `units` from the IEBC gazette CSV (counties, constituencies, wards and their
 * parent codes) and boundaries/overrides/provinces.csv (county -> province).
 * Idempotent: upserts on (level, code). Names come only from the gazette CSV.
 *
 *   php artisan db:seed --class=UnitsSeeder
 */
class UnitsSeeder extends Seeder
{
    public const GAZETTE_CSV = 'data/reference/iebc_wards_2027_gn13771.csv';

    public const PROVINCES_CSV = 'boundaries/overrides/provinces.csv';

    public function run(): void
    {
        $now = now();
        $rows = [];

        $provinceOf = [];
        foreach ($this->readCsv(base_path(self::PROVINCES_CSV)) as $r) {
            $provinceOf[(int) $r['county_code']] = (int) $r['province_code'];
            $rows['province:'.$r['province_code']] = [
                'level' => 'province',
                'code' => (int) $r['province_code'],
                'name' => trim($r['province_name']),
                'parent_level' => null,
                'parent_code' => null,
                'source' => self::PROVINCES_CSV,
            ];
        }

        foreach ($this->readCsv(base_path(self::GAZETTE_CSV)) as $r) {
            $county = (int) $r['county_code'];
            $const = (int) $r['const_code'];
            $ward = (int) $r['caw_code'];
            $source = trim($r['source']);

            if (! isset($provinceOf[$county])) {
                throw new RuntimeException("County {$county} has no province in ".self::PROVINCES_CSV);
            }

            $this->put($rows, 'county', $county, $r['county_name'], 'province', $provinceOf[$county], $source);
            $this->put($rows, 'constituency', $const, $r['const_name'], 'county', $county, $source);
            $this->put($rows, 'ward', $ward, $r['caw_name'], 'constituency', $const, $source);
        }

        $rows = array_map(fn (array $row) => $row + ['created_at' => $now, 'updated_at' => $now], array_values($rows));

        DB::transaction(function () use ($rows) {
            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('units')->upsert(
                    $chunk,
                    ['level', 'code'],
                    ['name', 'parent_level', 'parent_code', 'source', 'updated_at'],
                );
            }
        });
    }

    /**
     * Add a unit, failing loudly if the gazette gives one code two names or parents.
     *
     * @param  array<string, array<string, mixed>>  $rows
     */
    private function put(array &$rows, string $level, int $code, string $name, string $parentLevel, int $parentCode, string $source): void
    {
        $key = "{$level}:{$code}";
        $name = trim($name);

        if (isset($rows[$key])) {
            if ($rows[$key]['name'] !== $name || $rows[$key]['parent_code'] !== $parentCode) {
                throw new RuntimeException("Inconsistent gazette rows for {$level} {$code}");
            }

            return;
        }

        $rows[$key] = [
            'level' => $level,
            'code' => $code,
            'name' => $name,
            'parent_level' => $parentLevel,
            'parent_code' => $parentCode,
            'source' => $source,
        ];
    }

    /** @return list<array<string,string>> */
    private function readCsv(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new RuntimeException("Cannot read {$path}");
        }

        $header = fgetcsv($handle, escape: '');
        if ($header === false) {
            throw new RuntimeException("{$path} is empty");
        }
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
        $out = [];
        while (($line = fgetcsv($handle, escape: '')) !== false) {
            if ($line === [null]) {
                continue;
            }
            $out[] = array_combine($header, $line);
        }
        fclose($handle);

        return $out;
    }
}

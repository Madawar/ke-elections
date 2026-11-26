<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    /**
     * Units from the gazette, then the sourced party register and office holders
     * (data/sources/), through the same validated importer used for new data.
     */
    public function run(): void
    {
        $this->call(UnitsSeeder::class);

        $files = [
            ['parties', 'data/sources/parties.csv'],
            ['holders', 'data/sources/holders/national_assembly.csv'],
            ['holders', 'data/sources/holders/county_seats.csv'],
            ['holders', 'data/sources/holders/mca.csv'],
        ];
        foreach ($files as [$kind, $file]) {
            if (! is_file(base_path($file))) {
                continue;
            }
            $code = Artisan::call('data:import', ['kind' => $kind, 'file' => $file]);
            $this->command?->getOutput()->write(Artisan::output());
            if ($code !== 0) {
                throw new RuntimeException("Importing {$file} failed");
            }
        }
    }
}

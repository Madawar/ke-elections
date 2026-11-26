<?php

namespace App\Console\Commands;

use App\Imports\HoldersImporter;
use App\Imports\ImportReport;
use App\Imports\NominationsImporter;
use App\Imports\PartiesImporter;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * Validated, all-or-nothing CSV import of parties, office holders and nominations.
 * See docs/data-import.md.
 */
class DataImport extends Command
{
    protected $signature = 'data:import
        {kind : parties | holders | nominations}
        {file : path to the CSV file}
        {--dry-run : validate and show what would change, without writing anything}
        {--colours= : parties only: colours CSV (abbrev,colour); default data/sources/party_colours.csv if present}';

    protected $description = 'Validate and import a CSV of parties, office holders or nominations (all rows or none)';

    public function handle(): int
    {
        $kind = (string) $this->argument('kind');
        $file = (string) $this->argument('file');
        $dryRun = (bool) $this->option('dry-run');

        $importer = match ($kind) {
            'parties' => (new PartiesImporter)->withColours($this->option('colours') ?: null),
            'holders' => new HoldersImporter,
            'nominations' => new NominationsImporter,
            default => null,
        };

        if ($importer === null) {
            $this->error("Unknown kind '{$kind}'. Use parties, holders or nominations.");

            return self::FAILURE;
        }

        if (! is_file($file) && is_file(base_path($file))) {
            $file = base_path($file);
        }

        try {
            $report = $importer->run($file, $dryRun);
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        foreach (ImportReport::sorted($report->warnings) as $w) {
            $this->line('<comment>'.$this->prefix($w['line']).'WARNING: '.$w['message'].'</comment>');
        }

        if ($report->hasErrors()) {
            foreach (ImportReport::sorted($report->errors) as $e) {
                $this->line('<error>'.$this->prefix($e['line']).$e['message'].'</error>');
            }
            $this->newLine();
            $this->error(sprintf('%d problem(s) found in %s. Nothing was imported.', count($report->errors), basename($file)));

            return self::FAILURE;
        }

        $rows = $report->created + $report->updated + $report->unchanged;

        if ($dryRun) {
            $this->info(sprintf('Dry run, nothing was written. %s (%s): %d rows: %d to create, %d to update, %d unchanged.',
                basename($file), $kind, $rows, $report->created, $report->updated, $report->unchanged));
        } else {
            $this->info(sprintf('Imported %s (%s): %d rows: %d created, %d updated, %d unchanged.',
                basename($file), $kind, $rows, $report->created, $report->updated, $report->unchanged));
        }

        return self::SUCCESS;
    }

    private function prefix(?int $line): string
    {
        return $line === null ? '' : "Line {$line}: ";
    }
}

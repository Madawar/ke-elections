<?php

namespace App\Imports;

use App\Models\Party;
use App\Models\PartyAlias;

/**
 * Political parties (ORPP register) and their former names (party_aliases).
 * Natural keys: parties.abbrev, party_aliases.alias.
 *
 * Display colours: a row's optional display_colour column, overridden by
 * data/sources/party_colours.csv (abbrev,colour) when that file exists.
 * With neither, the colour stays null and the UI shows the party as grey "Other".
 */
class PartiesImporter extends Importer
{
    public const COLOURS_CSV = 'data/sources/party_colours.csv';

    private ?string $coloursPath = null;

    public function kind(): string
    {
        return 'parties';
    }

    public function requiredHeaders(): array
    {
        return ['abbrev', 'name', 'status', 'coalition_2022', 'renamed_from', 'renamed_on', 'orpp_colours_text', 'source_url', 'notes'];
    }

    public function optionalHeaders(): array
    {
        return ['display_colour'];
    }

    public function withColours(?string $path): static
    {
        $this->coloursPath = $path;

        return $this;
    }

    protected function prepare(CsvFile $csv, ImportReport $report): array
    {
        $colours = $this->readColours($report);

        $inFile = [];
        foreach ($csv->rows as $line => $row) {
            if ($row['abbrev'] !== '') {
                $inFile[strtoupper($row['abbrev'])] ??= $line;
            }
        }
        $dbParties = Party::query()->pluck('abbrev')->mapWithKeys(fn ($a) => [strtoupper($a) => true])->all();
        $dbAliases = PartyAlias::query()->with('party:id,abbrev')->get()
            ->mapWithKeys(fn (PartyAlias $a) => [strtoupper($a->alias) => $a->party?->abbrev])->all();

        $prepared = [];
        $seenAliases = [];

        foreach ($csv->rows as $line => $row) {
            $errorsBefore = count($report->errors);
            $abbrev = $row['abbrev'];
            $upper = strtoupper($abbrev);

            if ($abbrev === '') {
                $report->error($line, 'abbrev: is required');
            } elseif (strlen($abbrev) > 32) {
                $report->error($line, 'abbrev: is longer than 32 characters');
            } elseif ($upper === Party::INDEPENDENT) {
                $report->error($line, 'abbrev: '.Party::INDEPENDENT.' is reserved for independent candidates');
            } elseif ($inFile[$upper] !== $line) {
                $report->error($line, "abbrev: duplicate of line {$inFile[$upper]} ('{$abbrev}')");
            } elseif (isset($dbAliases[$upper]) && strtoupper((string) $dbAliases[$upper]) !== $upper) {
                $report->error($line, "abbrev: '{$abbrev}' is already an alias of {$dbAliases[$upper]}");
            }

            $name = $this->clean($row['name']);
            if ($name === '') {
                $report->error($line, 'name: is required');
            }
            $status = $this->clean($row['status']);
            if ($status === '') {
                $report->error($line, 'status: is required (as in the ORPP register)');
            }

            $alias = null;
            if ($row['renamed_from'] !== '') {
                $alias = $row['renamed_from'];
                $aliasUpper = strtoupper($alias);
                if ($aliasUpper === $upper || $aliasUpper === Party::INDEPENDENT) {
                    $report->error($line, "renamed_from: '{$alias}' cannot be an alias here");
                } elseif (isset($inFile[$aliasUpper]) || isset($dbParties[$aliasUpper])) {
                    $report->error($line, "renamed_from: '{$alias}' is itself a party abbrev; it cannot also be an alias");
                } elseif (isset($dbAliases[$aliasUpper]) && strtoupper((string) $dbAliases[$aliasUpper]) !== $upper) {
                    $report->error($line, "renamed_from: '{$alias}' is already the former name of {$dbAliases[$aliasUpper]}; it cannot move to {$abbrev}");
                } elseif (isset($seenAliases[$aliasUpper])) {
                    $report->error($line, "renamed_from: '{$alias}' is already the former name of line {$seenAliases[$aliasUpper]}");
                } else {
                    $seenAliases[$aliasUpper] = $line;
                }
            }
            $renamedOn = $this->checkDate($line, $row['renamed_on'], $report, 'renamed_on', false);
            if ($renamedOn !== null && $alias === null) {
                $report->error($line, 'renamed_on: is set but renamed_from is empty');
            }

            $colour = null;
            if (($row['display_colour'] ?? '') !== '') {
                $colour = $this->checkColour($line, $row['display_colour'], $report, 'display_colour');
            }
            if (isset($colours[$upper])) {
                $colour = $colours[$upper];
            }

            $sourceUrl = $this->checkUrl($line, $row['source_url'], $report);

            if (count($report->errors) > $errorsBefore) {
                continue;
            }

            $prepared[] = [
                'line' => $line,
                'abbrev' => $abbrev,
                'alias' => $alias,
                'renamed_on' => $renamedOn,
                'attributes' => [
                    'abbrev' => $abbrev,
                    'name' => $name,
                    'status' => $status,
                    'coalition_2022' => $this->nullable($row['coalition_2022']),
                    'display_colour' => $colour,
                    'orpp_colours_text' => $this->nullable($row['orpp_colours_text']),
                    'source_url' => $sourceUrl,
                    'notes' => $this->nullable($row['notes']),
                ],
            ];
        }

        foreach (array_diff_key($colours, $inFile) as $abbrev => $_) {
            $report->warning(null, self::COLOURS_CSV." lists {$abbrev}, which is not in this parties file; ignored");
        }

        return $prepared;
    }

    /** @param  list<array<string,mixed>>  $prepared */
    protected function persist(array $prepared, ImportReport $report, ?int $batchId, bool $dryRun): void
    {
        $parties = Party::query()->get()->keyBy(fn (Party $p) => strtoupper($p->abbrev));
        $aliases = PartyAlias::query()->get()->keyBy(fn (PartyAlias $a) => strtoupper($a->alias));

        foreach ($prepared as $p) {
            $party = $this->upsert(Party::class, $parties->get(strtoupper($p['abbrev'])), $p['attributes'], $report, $batchId, $dryRun);

            if ($p['alias'] === null || $dryRun || $party === null) {
                continue;
            }

            // Aliases are written with their party but are not counted as rows of their own.
            $this->upsert(PartyAlias::class, $aliases->get(strtoupper($p['alias'])), [
                'alias' => $p['alias'],
                'party_id' => $party->id,
                'effective_on' => $p['renamed_on'],
            ], new ImportReport, $batchId, false);
        }
    }

    /** @return array<string,string> upper-case abbrev => #rrggbb */
    private function readColours(ImportReport $report): array
    {
        $path = $this->coloursPath ?? base_path(self::COLOURS_CSV);
        if (! is_file($path)) {
            return [];
        }

        $csv = CsvFile::read($path);
        $label = basename($path);

        if (array_diff(['abbrev', 'colour'], $csv->header) !== []) {
            $report->error(null, "{$label}: expected header abbrev,colour");

            return [];
        }
        foreach ($csv->shapeErrors as $line => $message) {
            $report->error(null, "{$label} line {$line}: {$message}");
        }

        $colours = [];
        foreach ($csv->rows as $line => $row) {
            $colour = $this->checkColour($line, $row['colour'], $report, "{$label} colour", $label);
            if ($colour !== null && $row['abbrev'] !== '') {
                $colours[strtoupper($row['abbrev'])] = $colour;
            }
        }

        return $colours;
    }

    private function checkColour(int $line, string $value, ImportReport $report, string $field, ?string $file = null): ?string
    {
        if (preg_match('/^#[0-9a-fA-F]{6}$/', $value)) {
            return strtolower($value);
        }

        $message = "{$field}: '{$value}' is not a #RRGGBB colour";
        $file === null ? $report->error($line, $message) : $report->error(null, "{$file} line {$line}: {$message}");

        return null;
    }
}

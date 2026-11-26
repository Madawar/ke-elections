<?php

namespace App\Imports;

use App\Enums\NominationStatus;
use App\Models\Nomination;

/**
 * Party nominations for an election, and later their outcome (status elected/lost).
 * Natural key: election_year + seat + unit + candidate_name.
 */
class NominationsImporter extends Importer
{
    public function kind(): string
    {
        return 'nominations';
    }

    public function requiredHeaders(): array
    {
        return ['election_year', 'seat', 'unit_level', 'unit_code', 'unit_name_in_source', 'candidate_name',
            'party_abbrev', 'status', 'source_url', 'notes'];
    }

    protected function prepare(CsvFile $csv, ImportReport $report): array
    {
        $prepared = [];
        $seen = [];

        foreach ($csv->rows as $line => $row) {
            $errorsBefore = count($report->errors);

            $year = null;
            if (! preg_match('/^\d{4}$/', $row['election_year']) || (int) $row['election_year'] < 2013) {
                $report->error($line, "election_year: '{$row['election_year']}' is not a four-digit year (2013 or later)");
            } else {
                $year = (int) $row['election_year'];
            }

            $seat = $this->checkSeat($line, $row['seat'], $report);
            $unit = $this->checkUnit($line, $seat, $row['unit_level'], $row['unit_code'], $row['unit_name_in_source'], $report);

            $name = $this->clean($row['candidate_name']);
            if ($name === '') {
                $report->error($line, 'candidate_name: is required');
            }

            [, $partyId] = $this->checkParty($line, $row['party_abbrev'], $report);

            $status = NominationStatus::tryFrom(strtolower($row['status']));
            if ($status === null) {
                $report->error($line, "status: '{$row['status']}' is not one of ".implode(', ', NominationStatus::values()));
            }

            $sourceUrl = $this->checkUrl($line, $row['source_url'], $report);

            $key = null;
            if ($year !== null && $seat !== null && $unit !== null && $name !== '') {
                $key = self::key($year, $seat->value, $unit[0], $unit[1], $name);
                if (isset($seen[$key])) {
                    $report->error($line, "duplicate of line {$seen[$key]} (same election_year, seat, unit and candidate_name)");
                } else {
                    $seen[$key] = $line;
                }
            }

            if (count($report->errors) > $errorsBefore) {
                continue;
            }

            $prepared[] = [
                'line' => $line,
                'key' => $key,
                'group' => "{$year}|{$seat->value}|{$unit[0]}|{$unit[1]}",
                'nominated_seat' => $seat->isNominated(),
                'attributes' => [
                    'election_year' => $year,
                    'seat' => $seat->value,
                    'unit_level' => $unit[0],
                    'unit_code' => $unit[1],
                    'candidate_name' => $name,
                    'party_id' => $partyId,
                    'status' => $status->value,
                    'source_url' => $sourceUrl,
                    'notes' => $this->nullable($row['notes']),
                ],
            ];
        }

        $this->checkOneWinner($prepared, $report);

        return $prepared;
    }

    /**
     * At most one `elected` candidate per year + elected seat + unit (database included).
     *
     * @param  list<array<string,mixed>>  $prepared
     */
    private function checkOneWinner(array $prepared, ImportReport $report): void
    {
        $groups = [];

        Nomination::query()->where('status', NominationStatus::Elected->value)->each(function (Nomination $n) use (&$groups) {
            $groups["{$n->election_year}|{$n->seat}|{$n->unit_level}|{$n->unit_code}"][self::key($n->election_year, $n->seat, $n->unit_level, $n->unit_code, $n->candidate_name)]
                = ['line' => null, 'name' => $n->candidate_name, 'elected' => true];
        });

        foreach ($prepared as $p) {
            if ($p['nominated_seat']) {
                continue;
            }
            $groups[$p['group']][$p['key']] = [
                'line' => $p['line'],
                'name' => $p['attributes']['candidate_name'],
                'elected' => $p['attributes']['status'] === NominationStatus::Elected->value,
            ];
        }

        foreach ($groups as $group => $candidates) {
            $elected = array_filter($candidates, fn ($c) => $c['elected']);
            if (count($elected) < 2 || str_contains($group, '|nominated_')) {
                continue;
            }

            [$year, $seat, $level, $code] = explode('|', $group);
            $list = implode('; ', array_map(
                fn ($c) => $c['name'].' ('.($c['line'] ? "line {$c['line']}" : 'already imported').')',
                $elected,
            ));

            foreach ($elected as $c) {
                if ($c['line'] !== null) {
                    $report->error($c['line'], "status: {$year} {$seat} {$level} {$code} would have ".count($elected)." elected candidates: {$list}");
                }
            }
        }
    }

    /** @param  list<array<string,mixed>>  $prepared */
    protected function persist(array $prepared, ImportReport $report, ?int $batchId, bool $dryRun): void
    {
        $existing = Nomination::query()->get()->keyBy(
            fn (Nomination $n) => self::key($n->election_year, $n->seat, $n->unit_level, $n->unit_code, $n->candidate_name),
        );

        foreach ($prepared as $p) {
            $this->upsert(Nomination::class, $existing->get($p['key']), $p['attributes'], $report, $batchId, $dryRun);
        }
    }

    public static function key(int $year, string $seat, string $level, int $code, string $name): string
    {
        return implode('|', [$year, $seat, $level, $code, mb_strtolower($name)]);
    }
}

<?php

namespace App\Imports;

use App\Enums\Seat;
use App\Models\OfficeHolder;

/**
 * Office holders (terms of office). Natural key: seat + unit + holder_name + started_on.
 */
class HoldersImporter extends Importer
{
    /** succession = a deputy governor taking over the seat (Constitution Art. 182); governors only. */
    public const BASES = ['elected', 'by_election', 'succession', 'nominated'];

    public const CONFIDENCE = ['high', 'medium', 'low'];

    public function kind(): string
    {
        return 'holders';
    }

    public function requiredHeaders(): array
    {
        return ['seat', 'unit_level', 'unit_code', 'unit_name_in_source', 'holder_name', 'party_abbrev',
            'party_name_in_source', 'basis', 'started_on', 'ended_on', 'confidence', 'source_url', 'notes'];
    }

    protected function prepare(CsvFile $csv, ImportReport $report): array
    {
        $prepared = [];
        $seen = [];

        foreach ($csv->rows as $line => $row) {
            $errorsBefore = count($report->errors);
            $key = null;

            $seat = $this->checkSeat($line, $row['seat'], $report);
            $unit = $this->checkUnit($line, $seat, $row['unit_level'], $row['unit_code'], $row['unit_name_in_source'], $report);

            $name = $this->clean($row['holder_name']);
            if ($name === '') {
                $report->error($line, 'holder_name: is required');
            }

            [, $partyId] = $this->checkParty($line, $row['party_abbrev'], $report);

            $basis = strtolower($row['basis']);
            if (! in_array($basis, self::BASES, true)) {
                $report->error($line, "basis: '{$row['basis']}' is not one of ".implode(', ', self::BASES));
            } elseif ($seat !== null && $seat->isNominated() !== ($basis === 'nominated')) {
                $report->error($line, $seat->isNominated()
                    ? "basis: seat {$seat->value} must have basis nominated"
                    : "basis: seat {$seat->value} is elected (elected, by_election or succession), not nominated");
            } elseif ($basis === 'succession' && $seat !== Seat::Governor) {
                $report->error($line, "basis: succession applies only to governors, not {$seat?->value}");
            }

            $startedOn = $this->checkDate($line, $row['started_on'], $report, 'started_on', true);
            $endedOn = $this->checkDate($line, $row['ended_on'], $report, 'ended_on', false);
            if ($startedOn !== null && $endedOn !== null && $endedOn < $startedOn) {
                $report->error($line, "ended_on: {$endedOn} is before started_on {$startedOn}");
            }

            $confidence = strtolower($row['confidence']);
            if (! in_array($confidence, self::CONFIDENCE, true)) {
                $report->error($line, "confidence: '{$row['confidence']}' is not one of ".implode(', ', self::CONFIDENCE));
            }

            $sourceUrl = $this->checkUrl($line, $row['source_url'], $report);

            if ($seat !== null && $unit !== null && $name !== '' && $startedOn !== null) {
                $key = self::key($seat->value, $unit[0], $unit[1], $name, $startedOn);
                if (isset($seen[$key])) {
                    $report->error($line, "duplicate of line {$seen[$key]} (same seat, unit, holder_name and started_on)");
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
                'group' => "{$seat->value}|{$unit[0]}|{$unit[1]}",
                'attributes' => [
                    'seat' => $seat->value,
                    'unit_level' => $unit[0],
                    'unit_code' => $unit[1],
                    'holder_name' => $name,
                    'party_id' => $partyId,
                    'basis' => $basis,
                    'started_on' => $startedOn,
                    'ended_on' => $endedOn,
                    'confidence' => $confidence,
                    'source_url' => $sourceUrl,
                    'notes' => $this->nullable($row['notes']),
                ],
            ];
        }

        $this->checkOneCurrentHolder($prepared, $report);

        return $prepared;
    }

    /**
     * At most one current (ended_on empty) holder per elected seat + unit, counting the
     * records already in the database that this file does not touch.
     *
     * @param  list<array<string,mixed>>  $prepared
     */
    private function checkOneCurrentHolder(array $prepared, ImportReport $report): void
    {
        $nominated = array_map(fn (Seat $s) => $s->value, array_filter(Seat::cases(), fn (Seat $s) => $s->isNominated()));

        /** @var array<string, array<string, array{line:int|null, name:string, started_on:string, current:bool}>> $groups */
        $groups = [];

        OfficeHolder::query()->whereNotIn('seat', $nominated)->each(function (OfficeHolder $h) use (&$groups) {
            $started = $h->started_on->format('Y-m-d');
            $groups["{$h->seat}|{$h->unit_level}|{$h->unit_code}"][self::key($h->seat, $h->unit_level, $h->unit_code, $h->holder_name, $started)] = [
                'line' => null, 'name' => $h->holder_name, 'started_on' => $started, 'current' => $h->ended_on === null,
            ];
        });

        foreach ($prepared as $p) {
            if (in_array($p['attributes']['seat'], $nominated, true)) {
                continue;
            }
            $groups[$p['group']][$p['key']] = [
                'line' => $p['line'],
                'name' => $p['attributes']['holder_name'],
                'started_on' => $p['attributes']['started_on'],
                'current' => $p['attributes']['ended_on'] === null,
            ];
        }

        foreach ($groups as $group => $holders) {
            $current = array_filter($holders, fn ($h) => $h['current']);
            if (count($current) < 2) {
                continue;
            }

            [$seat, $level, $code] = explode('|', $group);
            $list = implode('; ', array_map(
                fn ($h) => "{$h['name']} (".($h['line'] ? "line {$h['line']}" : 'already imported').", started {$h['started_on']})",
                $current,
            ));

            foreach ($current as $h) {
                if ($h['line'] !== null) {
                    $report->error($h['line'], "{$seat} {$level} {$code} would have ".count($current)
                        ." current holders: {$list}. Set ended_on on the earlier term(s).");
                }
            }
        }
    }

    /** @param  list<array<string,mixed>>  $prepared */
    protected function persist(array $prepared, ImportReport $report, ?int $batchId, bool $dryRun): void
    {
        $existing = OfficeHolder::query()->get()->keyBy(
            fn (OfficeHolder $h) => self::key($h->seat, $h->unit_level, $h->unit_code, $h->holder_name, $h->started_on->format('Y-m-d')),
        );

        foreach ($prepared as $p) {
            $this->upsert(OfficeHolder::class, $existing->get($p['key']), $p['attributes'], $report, $batchId, $dryRun);
        }
    }

    public static function key(string $seat, string $level, int $code, string $name, string $startedOn): string
    {
        return implode('|', [$seat, $level, $code, mb_strtolower($name), $startedOn]);
    }
}

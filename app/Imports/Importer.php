<?php

namespace App\Imports;

use App\Enums\Seat;
use App\Models\Audit;
use App\Models\ImportBatch;
use App\Models\Party;
use App\Models\PartyAlias;
use App\Models\Unit;
use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Shared machinery for `php artisan data:import`: header checks, field validators,
 * unit/party lookups, all-or-nothing apply in a transaction, upsert + audit.
 *
 * A subclass validates every row in prepare() (collecting all problems with their
 * line numbers) and writes the prepared rows in persist(). Nothing is written when
 * any row has an error, or on a dry run.
 */
abstract class Importer
{
    /** @var array<string,string>|null "level:code" => unit name */
    private ?array $units = null;

    /** @var array<string,int>|null upper-case abbrev or alias => party id */
    private ?array $parties = null;

    abstract public function kind(): string;

    /** @return list<string> */
    abstract public function requiredHeaders(): array;

    /** @return list<string> */
    public function optionalHeaders(): array
    {
        return [];
    }

    /**
     * Validate every row. Errors and warnings go into $report.
     *
     * @return list<array<string,mixed>> prepared rows for persist()
     */
    abstract protected function prepare(CsvFile $csv, ImportReport $report): array;

    /**
     * Write prepared rows (inside a transaction; on a dry run only count outcomes).
     *
     * @param  list<array<string,mixed>>  $prepared
     */
    abstract protected function persist(array $prepared, ImportReport $report, ?int $batchId, bool $dryRun): void;

    public function run(string $path, bool $dryRun = false): ImportReport
    {
        $report = new ImportReport;
        $csv = CsvFile::read($path);

        $missing = array_diff($this->requiredHeaders(), $csv->header);
        if ($missing !== []) {
            $report->error(1, 'missing header column(s): '.implode(', ', $missing)
                .'. Expected header: '.implode(',', $this->requiredHeaders()));

            return $report;
        }

        $unknown = array_diff($csv->header, $this->requiredHeaders(), $this->optionalHeaders());
        if ($unknown !== []) {
            $report->warning(1, 'ignoring unknown column(s): '.implode(', ', $unknown));
        }

        foreach ($csv->shapeErrors as $line => $message) {
            $report->error($line, $message);
        }

        if ($csv->rows === [] && $csv->shapeErrors === []) {
            $report->error(null, 'the file has no data rows');

            return $report;
        }

        $prepared = $this->prepare($csv, $report);

        if ($report->hasErrors()) {
            return $report;
        }

        if ($dryRun) {
            $this->persist($prepared, $report, null, true);

            return $report;
        }

        DB::transaction(function () use ($prepared, $report, $csv, $path) {
            $batch = ImportBatch::create([
                'kind' => $this->kind(),
                'file' => $this->displayPath($path),
                'sha256' => hash_file('sha256', $path),
                'row_count' => count($csv->rows),
                'imported_at' => now(),
            ]);

            $this->persist($prepared, $report, $batch->id, false);

            $batch->update([
                'created_count' => $report->created,
                'updated_count' => $report->updated,
                'unchanged_count' => $report->unchanged,
            ]);
        });

        return $report;
    }

    /**
     * Create or update one record by its natural key and audit the change.
     * Counts the outcome (created | updated | unchanged) in $report and returns the
     * record, or null for a record that a dry run would create.
     *
     * @template TModel of Model
     *
     * @param  class-string<TModel>  $class
     * @param  TModel|null  $existing
     * @param  array<string, mixed>  $attributes
     * @return TModel|null
     */
    protected function upsert(string $class, ?Model $existing, array $attributes, ImportReport $report, ?int $batchId, bool $dryRun): ?Model
    {
        $fields = array_keys($attributes);

        if ($existing === null) {
            $report->count('created');
            if ($dryRun) {
                return null;
            }
            $model = $class::create($attributes + ['import_batch_id' => $batchId]);
            Audit::record($model, 'created', null, $this->snapshot($model, $fields), $batchId);

            return $model;
        }

        $old = $this->snapshot($existing, $fields);
        $candidate = (clone $existing)->fill($attributes);
        $new = $this->snapshot($candidate, $fields);

        if ($old === $new) {
            $report->count('unchanged');

            return $existing;
        }

        $report->count('updated');
        if ($dryRun) {
            return $existing;
        }

        $existing->fill($attributes + ['import_batch_id' => $batchId])->save();
        Audit::record($existing, 'updated', $old, $this->snapshot($existing, $fields), $batchId);

        return $existing;
    }

    /**
     * Attribute values as plain scalars (dates as Y-m-d) for audits and comparison.
     *
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    protected function snapshot(Model $model, array $fields): array
    {
        $out = [];
        foreach ($fields as $field) {
            $value = $model->getAttribute($field);
            if ($value instanceof DateTimeInterface) {
                $value = $value->format('Y-m-d');
            } elseif (is_numeric($value) && ! is_string($value)) {
                $value = (int) $value;
            } elseif ($value === '') {
                $value = null;
            }
            $out[$field] = $value;
        }

        return $out;
    }

    // ---------------------------------------------------------------- validators

    protected function nullable(string $value): ?string
    {
        $value = trim($value);

        return $value === '' ? null : $value;
    }

    /** Trim and collapse internal whitespace (names). */
    protected function clean(string $value): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    protected function checkUrl(int $line, string $value, ImportReport $report, string $field = 'source_url'): ?string
    {
        if ($value === '') {
            $report->error($line, "{$field}: is required (every record cites a source)");

            return null;
        }

        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
        if (filter_var($value, FILTER_VALIDATE_URL) === false || ! in_array($scheme, ['http', 'https'], true)) {
            $report->error($line, "{$field}: '{$value}' is not an http(s) URL");

            return null;
        }

        return $value;
    }

    /** Validate a Y-m-d date. Returns the normalised date or null (blank or invalid). */
    protected function checkDate(int $line, string $value, ImportReport $report, string $field, bool $required): ?string
    {
        if ($value === '') {
            if ($required) {
                $report->error($line, "{$field}: is required (YYYY-MM-DD)");
            }

            return null;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $errors = DateTimeImmutable::getLastErrors();
        if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            $report->error($line, "{$field}: '{$value}' is not a valid date (YYYY-MM-DD)");

            return null;
        }

        return $date->format('Y-m-d');
    }

    protected function checkSeat(int $line, string $value, ImportReport $report): ?Seat
    {
        $seat = Seat::tryFrom(strtolower($value));
        if ($seat === null) {
            $report->error($line, "seat: '{$value}' is not one of ".implode(', ', Seat::values()));
        }

        return $seat;
    }

    /**
     * Check that the unit exists and matches the seat's level. Joins on code only.
     * Warns (never errors) when the source's unit name does not resemble ours.
     *
     * @return array{0:string,1:int}|null [level, code]
     */
    protected function checkUnit(int $line, ?Seat $seat, string $level, string $code, string $nameInSource, ImportReport $report): ?array
    {
        $level = strtolower($level);
        $levels = [Seat::NATIONAL, 'county', 'constituency', 'ward'];

        if (! in_array($level, $levels, true)) {
            $report->error($line, "unit_level: '{$level}' is not one of ".implode(', ', $levels));

            return null;
        }

        if (! preg_match('/^\d+$/', $code)) {
            $report->error($line, "unit_code: '{$code}' is not a whole number (IEBC code)");

            return null;
        }
        $code = (int) $code;

        if ($seat !== null && $seat->level() !== $level) {
            $report->error($line, "unit_level: seat {$seat->value} belongs to {$seat->level()} units, not {$level}");

            return null;
        }

        if ($level === Seat::NATIONAL) {
            if ($code !== 0) {
                $report->error($line, "unit_code: national seats use unit_code 0, not {$code}");

                return null;
            }

            return [$level, 0];
        }

        $name = $this->units()["{$level}:{$code}"] ?? null;
        if ($name === null) {
            $report->error($line, "unit_code: {$level} {$code} is not an IEBC unit code");

            return null;
        }

        if ($nameInSource !== '' && ! $this->namesResemble($nameInSource, $name)) {
            $report->warning($line, "unit_name_in_source '{$nameInSource}' does not look like {$level} {$code} ({$name}); the code is used, check it");
        }

        return [$level, $code];
    }

    /**
     * Resolve a party abbreviation (or alias). Returns [ok, party_id]; IND = independent = null.
     *
     * @return array{0:bool,1:int|null}
     */
    protected function checkParty(int $line, string $abbrev, ImportReport $report): array
    {
        if ($abbrev === '') {
            $report->error($line, 'party_abbrev: is required (use '.Party::INDEPENDENT.' for independents)');

            return [false, null];
        }

        if (strtoupper($abbrev) === Party::INDEPENDENT) {
            return [true, null];
        }

        $id = $this->parties()[strtoupper($abbrev)] ?? null;
        if ($id === null) {
            $report->error($line, "party_abbrev: '{$abbrev}' is not in parties or party_aliases (import parties first; use "
                .Party::INDEPENDENT.' for independents)');

            return [false, null];
        }

        return [true, $id];
    }

    /** Loose comparison of a unit name from a source with the gazette name. */
    protected function namesResemble(string $a, string $b): bool
    {
        $norm = function (string $s): string {
            $s = mb_strtolower($s);
            $s = (string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', $s);
            $s = (string) preg_replace('/\b(ward|county|constituency|city)\b/u', ' ', $s);

            return trim((string) preg_replace('/\s+/', ' ', $s));
        };

        $a = $norm($a);
        $b = $norm($b);

        if ($a === '' || $b === '' || $a === $b) {
            return true;
        }

        $a2 = str_replace(' ', '', $a);
        $b2 = str_replace(' ', '', $b);
        if (str_contains($a2, $b2) || str_contains($b2, $a2)) {
            return true;
        }

        $max = max(strlen($a2), strlen($b2));

        return levenshtein($a2, $b2) <= max(2, (int) floor($max * 0.25));
    }

    // ---------------------------------------------------------------- lookups

    /** @return array<string,string> */
    protected function units(): array
    {
        return $this->units ??= Unit::query()
            ->get(['level', 'code', 'name'])
            ->mapWithKeys(fn (Unit $u) => ["{$u->level}:{$u->code}" => $u->name])
            ->all();
    }

    /** @return array<string,int> */
    protected function parties(): array
    {
        if ($this->parties === null) {
            $this->parties = [];
            foreach (PartyAlias::query()->get(['alias', 'party_id']) as $alias) {
                $this->parties[strtoupper($alias->alias)] = $alias->party_id;
            }
            foreach (Party::query()->get(['id', 'abbrev']) as $party) {
                $this->parties[strtoupper($party->abbrev)] = $party->id; // an abbrev wins over an alias
            }
        }

        return $this->parties;
    }

    protected function displayPath(string $path): string
    {
        $real = realpath($path) ?: $path;
        $base = rtrim(base_path(), DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR;

        return str_starts_with($real, $base) ? substr($real, strlen($base)) : $real;
    }
}

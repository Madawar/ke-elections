<?php

namespace App\Imports;

use RuntimeException;

/**
 * Reads a CSV with a header row and keeps the physical line number of every record
 * (header = line 1), so errors can point at the right line even when a quoted field
 * spans several lines.
 */
final class CsvFile
{
    /**
     * @param  list<string>  $header
     * @param  array<int, array<string,string>>  $rows  line number => trimmed values by header
     * @param  array<int, string>  $shapeErrors  line number => problem with the row's column count
     */
    private function __construct(
        public readonly string $path,
        public readonly array $header,
        public readonly array $rows,
        public readonly array $shapeErrors,
    ) {}

    public static function read(string $path): self
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException("File not found or not readable: {$path}");
        }

        $content = (string) file_get_contents($path);
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);

        $stream = fopen('php://temp', 'r+');
        if ($stream === false) {
            throw new RuntimeException('Cannot open a temporary stream');
        }
        fwrite($stream, $content);
        rewind($stream);

        $header = null;
        $rows = [];
        $shapeErrors = [];
        $line = 1;

        while (true) {
            $start = (int) ftell($stream);
            $record = fgetcsv($stream, escape: '');
            if ($record === false) {
                break;
            }
            $end = (int) ftell($stream);
            $recordLine = $line;
            $line += substr_count($content, "\n", $start, $end - $start);

            if ($record === [null] || (count($record) === 1 && trim((string) $record[0]) === '')) {
                continue; // blank line
            }

            $record = array_map(fn ($v) => trim((string) $v), $record);

            if ($header === null) {
                $header = array_map('strtolower', $record);

                continue;
            }

            if (count($record) !== count($header)) {
                $shapeErrors[$recordLine] = sprintf('expected %d columns, found %d', count($header), count($record));

                continue;
            }

            $rows[$recordLine] = array_combine($header, $record);
        }

        fclose($stream);

        return new self($path, $header ?? [], $rows, $shapeErrors);
    }
}

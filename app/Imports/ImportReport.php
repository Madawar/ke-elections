<?php

namespace App\Imports;

/** Errors, warnings and counts collected while validating and applying one import. */
final class ImportReport
{
    /** @var list<array{line:int|null, message:string}> */
    public array $errors = [];

    /** @var list<array{line:int|null, message:string}> */
    public array $warnings = [];

    public int $created = 0;

    public int $updated = 0;

    public int $unchanged = 0;

    public function error(?int $line, string $message): void
    {
        $this->errors[] = ['line' => $line, 'message' => $message];
    }

    public function warning(?int $line, string $message): void
    {
        $this->warnings[] = ['line' => $line, 'message' => $message];
    }

    public function hasErrors(): bool
    {
        return $this->errors !== [];
    }

    public function count(string $outcome): void
    {
        $this->{$outcome}++;
    }

    /**
     * @param  list<array{line:int|null, message:string}>  $items
     * @return list<array{line:int|null, message:string}>
     */
    public static function sorted(array $items): array
    {
        usort($items, fn ($a, $b) => ($a['line'] ?? 0) <=> ($b['line'] ?? 0));

        return $items;
    }
}

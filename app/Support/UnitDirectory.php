<?php

namespace App\Support;

/**
 * Read-only index of every province, county, constituency and ward, built from
 * public/boundaries/units.json (written by the boundary pipeline). Keyed on IEBC codes.
 */
class UnitDirectory
{
    public const PARENT = ['ward' => 'constituency', 'constituency' => 'county', 'county' => 'province', 'province' => null];

    /** @var array<string, array<int, array{level:string, code:int, name:string, parentCode:?int, bbox:array<int,float>}>> */
    private array $units = [];

    /** @var array<string, array<int, list<int>>> */
    private array $children = [];

    public function __construct(string $path)
    {
        $rows = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        foreach ($rows as $row) {
            $unit = ['level' => $row['l'], 'code' => (int) $row['c'], 'name' => $row['n'], 'parentCode' => $row['p'] === null ? null : (int) $row['p'], 'bbox' => $row['b'] ?? []];
            $this->units[$unit['level']][$unit['code']] = $unit;
            $parentLevel = self::PARENT[$unit['level']] ?? null;
            if ($parentLevel !== null && $unit['parentCode'] !== null) {
                $this->children[$parentLevel][$unit['parentCode']][] = $unit['code'];
            }
        }
    }

    /** @return array{level:string, code:int, name:string, parentCode:?int, bbox:array<int,float>}|null */
    public function find(string $level, int $code): ?array
    {
        return $this->units[$level][$code] ?? null;
    }

    /** Nearest ancestor first, ending with the province. */
    public function ancestors(string $level, int $code): array
    {
        $out = [];
        $unit = $this->find($level, $code);
        while ($unit !== null && ($parentLevel = self::PARENT[$unit['level']]) !== null && $unit['parentCode'] !== null) {
            $unit = $this->find($parentLevel, $unit['parentCode']);
            if ($unit !== null) {
                $out[] = $unit;
            }
        }

        return $out;
    }

    public function children(string $level, int $code): array
    {
        $childLevel = array_search($level, self::PARENT, true);
        if ($childLevel === false) {
            return [];
        }

        return array_map(fn (int $c) => $this->units[$childLevel][$c], $this->children[$level][$code] ?? []);
    }
}

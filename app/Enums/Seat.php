<?php

namespace App\Enums;

/**
 * Seats on the ballot plus the nominated (party-list) seats.
 * Each seat is attached to exactly one unit level; nominated MPs and Senators
 * are national lists and use the pseudo-unit national/0.
 */
enum Seat: string
{
    case Governor = 'governor';
    case Senator = 'senator';
    case WomanRep = 'woman_rep';
    case Mp = 'mp';
    case Mca = 'mca';
    case NominatedMp = 'nominated_mp';
    case NominatedSenator = 'nominated_senator';
    case NominatedMca = 'nominated_mca';

    public const NATIONAL = 'national';

    public function level(): string
    {
        return match ($this) {
            self::Governor, self::Senator, self::WomanRep, self::NominatedMca => 'county',
            self::Mp => 'constituency',
            self::Mca => 'ward',
            self::NominatedMp, self::NominatedSenator => self::NATIONAL,
        };
    }

    public function isNominated(): bool
    {
        return in_array($this, [self::NominatedMp, self::NominatedSenator, self::NominatedMca], true);
    }

    /**
     * Seats whose members sit in the National Assembly (the Speaker is not counted).
     *
     * @return list<self>
     */
    public static function nationalAssembly(): array
    {
        return [self::Mp, self::WomanRep, self::NominatedMp];
    }

    /**
     * Seats whose members sit in the Senate (the Speaker is not counted).
     *
     * @return list<self>
     */
    public static function senate(): array
    {
        return [self::Senator, self::NominatedSenator];
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}

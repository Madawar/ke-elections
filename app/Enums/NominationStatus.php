<?php

namespace App\Enums;

enum NominationStatus: string
{
    case Nominated = 'nominated';
    case Withdrawn = 'withdrawn';
    case Disqualified = 'disqualified';
    case Elected = 'elected';
    case Lost = 'lost';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}

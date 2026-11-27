<?php

namespace App\Support;

use App\Models\Party;

/**
 * Finds a party for its page (`/party/uda`) by the abbreviation in the address, in any case.
 * Independents are not a party and have no page.
 */
class PartyDirectory
{
    public function find(string $abbrev): ?Party
    {
        if ($abbrev === '' || strtoupper($abbrev) === Party::INDEPENDENT) {
            return null;
        }

        return Party::query()->whereRaw('LOWER(abbrev) = ?', [strtolower($abbrev)])->first();
    }
}

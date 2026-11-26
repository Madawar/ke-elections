<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $abbrev
 * @property string $name
 * @property string $status
 * @property string|null $coalition_2022
 * @property string|null $display_colour
 * @property string|null $orpp_colours_text
 * @property string $source_url
 * @property string|null $notes
 */
class Party extends Model
{
    /** Abbreviation used in import files for independent candidates (stored as party_id = null). */
    public const INDEPENDENT = 'IND';

    protected $guarded = ['id'];

    /** @return HasMany<PartyAlias, $this> */
    public function aliases(): HasMany
    {
        return $this->hasMany(PartyAlias::class);
    }

    /** @return HasMany<OfficeHolder, $this> */
    public function officeHolders(): HasMany
    {
        return $this->hasMany(OfficeHolder::class);
    }
}

<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A former or alternative abbreviation of a party, e.g. after a rename.
 *
 * @property int $id
 * @property string $alias
 * @property int $party_id
 * @property CarbonImmutable|null $effective_on
 * @property-read Party|null $party
 */
class PartyAlias extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'effective_on' => 'date',
        ];
    }

    /** @return BelongsTo<Party, $this> */
    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }
}

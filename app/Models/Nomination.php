<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A candidate's nomination for an election; status tracks it through to elected/lost.
 *
 * @property int $id
 * @property int $election_year
 * @property string $seat
 * @property string $unit_level
 * @property int $unit_code
 * @property string $candidate_name
 * @property int|null $party_id
 * @property string $status
 * @property string $source_url
 * @property string|null $notes
 * @property int|null $import_batch_id
 * @property-read Party|null $party
 */
class Nomination extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'election_year' => 'integer',
            'unit_code' => 'integer',
            'party_id' => 'integer',
        ];
    }

    /** @return BelongsTo<Party, $this> */
    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    /** @return BelongsTo<ImportBatch, $this> */
    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class);
    }
}

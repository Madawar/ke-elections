<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One term of office. Current = ended_on is null. party_id null = independent.
 *
 * @property int $id
 * @property string $seat
 * @property string $unit_level
 * @property int $unit_code
 * @property string $holder_name
 * @property int|null $party_id
 * @property string $basis
 * @property CarbonImmutable $started_on
 * @property CarbonImmutable|null $ended_on
 * @property string $confidence
 * @property string $source_url
 * @property string|null $notes
 * @property int|null $import_batch_id
 * @property-read Party|null $party
 */
class OfficeHolder extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'unit_code' => 'integer',
            'party_id' => 'integer',
            'started_on' => 'date',
            'ended_on' => 'date',
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

    /** @param Builder<OfficeHolder> $query */
    public function scopeCurrent(Builder $query): void
    {
        $query->whereNull('ended_on');
    }
}

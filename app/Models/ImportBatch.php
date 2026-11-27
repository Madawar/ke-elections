<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One run of `php artisan data:import` that was applied (dry runs create none).
 *
 * @property int $id
 * @property string $kind
 * @property string $file
 * @property string $sha256
 * @property int $row_count
 * @property CarbonImmutable $imported_at
 */
class ImportBatch extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'row_count' => 'integer',
            'created_count' => 'integer',
            'updated_count' => 'integer',
            'unchanged_count' => 'integer',
            'imported_at' => 'datetime',
        ];
    }

    /** @return HasMany<Audit, $this> */
    public function audits(): HasMany
    {
        return $this->hasMany(Audit::class);
    }
}

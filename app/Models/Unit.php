<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An IEBC unit (province, county, constituency or ward), keyed by level + code.
 * Seeded by Database\Seeders\UnitsSeeder from the gazette CSV; never edited by hand.
 */
/**
 * @property int $id
 * @property string $level
 * @property int $code
 * @property string $name
 * @property string|null $parent_level
 * @property int|null $parent_code
 * @property string|null $source
 */
class Unit extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'code' => 'integer',
            'parent_code' => 'integer',
        ];
    }
}

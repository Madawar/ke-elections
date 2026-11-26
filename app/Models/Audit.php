<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Append-only change log: rows can be created but never updated or deleted.
 * `old`/`new` hold the record's attributes before and after the change.
 *
 * @property int $id
 * @property string $auditable_type
 * @property int $auditable_id
 * @property string $event
 * @property array<string, mixed>|null $old
 * @property array<string, mixed>|null $new
 * @property int|null $import_batch_id
 */
class Audit extends Model
{
    public const UPDATED_AT = null;

    /** Short, stable names stored in auditable_type (kept independent of PHP class names). */
    public const TYPES = [
        'party' => Party::class,
        'party_alias' => PartyAlias::class,
        'office_holder' => OfficeHolder::class,
        'nomination' => Nomination::class,
    ];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'old' => 'array',
            'new' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Audits are append-only.'));
        static::deleting(fn () => throw new LogicException('Audits are append-only.'));
    }

    /**
     * Write an audit row for a model change.
     *
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    public static function record(Model $model, string $event, ?array $old, ?array $new, ?int $batchId = null): self
    {
        return static::create([
            'auditable_type' => static::typeOf($model),
            'auditable_id' => $model->getKey(),
            'event' => $event,
            'old' => $old,
            'new' => $new,
            'import_batch_id' => $batchId,
        ]);
    }

    public static function typeOf(Model $model): string
    {
        foreach (static::TYPES as $type => $class) {
            if ($model instanceof $class) {
                return $type;
            }
        }

        throw new LogicException('No audit type registered for '.$model::class);
    }

    /** The audited record, if it still exists. */
    public function subject(): ?Model
    {
        $class = static::TYPES[$this->auditable_type] ?? null;

        return $class ? $class::find($this->auditable_id) : null;
    }

    /** @return BelongsTo<ImportBatch, $this> */
    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class);
    }
}

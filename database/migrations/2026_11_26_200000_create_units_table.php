<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Administrative and electoral units, keyed by IEBC code (never by name).
 * Seeded from data/reference/iebc_wards_2027_gn13771.csv (+ boundaries/overrides/provinces.csv).
 * Geometry is not stored here: it lives in public/boundaries/.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->enum('level', ['province', 'county', 'constituency', 'ward']);
            $table->unsignedSmallInteger('code');
            $table->string('name');
            $table->enum('parent_level', ['province', 'county', 'constituency'])->nullable();
            $table->unsignedSmallInteger('parent_code')->nullable();
            $table->text('source')->nullable();
            $table->timestamps();

            $table->unique(['level', 'code']);
            $table->index(['parent_level', 'parent_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('units');
    }
};

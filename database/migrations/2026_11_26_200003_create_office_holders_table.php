<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Terms of office. "Current" means ended_on IS NULL. The unit is joined on
 * (unit_level, unit_code) = IEBC code; nominated MPs/Senators use national/0.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('office_holders', function (Blueprint $table) {
            $table->id();
            $table->enum('seat', [
                'governor', 'senator', 'woman_rep', 'mp', 'mca',
                'nominated_mp', 'nominated_senator', 'nominated_mca',
            ]);
            $table->enum('unit_level', ['national', 'county', 'constituency', 'ward']);
            $table->unsignedSmallInteger('unit_code');
            $table->string('holder_name');
            $table->foreignId('party_id')->nullable()->constrained()->nullOnDelete(); // null = independent
            $table->string('basis', 32);
            $table->date('started_on');
            $table->date('ended_on')->nullable();
            $table->string('confidence', 16);
            $table->string('source_url', 2048);
            $table->text('notes')->nullable();
            $table->foreignId('import_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->unique(['seat', 'unit_level', 'unit_code', 'holder_name', 'started_on'], 'office_holders_natural_key');
            $table->index(['unit_level', 'unit_code']);
            $table->index(['seat', 'ended_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('office_holders');
    }
};

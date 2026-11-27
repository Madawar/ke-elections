<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->string('abbrev', 32)->unique();
            $table->string('name');
            $table->string('status', 64);
            $table->string('coalition_2022', 64)->nullable();
            // Neutral display colour chosen by us (#RRGGBB); null = shown as grey "Other".
            $table->char('display_colour', 7)->nullable();
            // The colours as registered with ORPP, kept as text for reference only.
            $table->string('orpp_colours_text')->nullable();
            $table->string('source_url', 2048);
            $table->text('notes')->nullable();
            $table->foreignId('import_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('party_aliases', function (Blueprint $table) {
            $table->id();
            $table->string('alias', 32)->unique();
            $table->foreignId('party_id')->constrained()->cascadeOnDelete();
            $table->date('effective_on')->nullable();
            $table->foreignId('import_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_aliases');
        Schema::dropIfExists('parties');
    }
};

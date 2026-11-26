<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nominations', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('election_year');
            $table->enum('seat', [
                'governor', 'senator', 'woman_rep', 'mp', 'mca',
                'nominated_mp', 'nominated_senator', 'nominated_mca',
            ]);
            $table->enum('unit_level', ['national', 'county', 'constituency', 'ward']);
            $table->unsignedSmallInteger('unit_code');
            $table->string('candidate_name');
            $table->foreignId('party_id')->nullable()->constrained()->restrictOnDelete(); // null = independent; a party with records can't be deleted
            $table->enum('status', ['nominated', 'withdrawn', 'disqualified', 'elected', 'lost']);
            $table->string('source_url', 2048);
            $table->text('notes')->nullable();
            $table->foreignId('import_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->unique(['election_year', 'seat', 'unit_level', 'unit_code', 'candidate_name'], 'nominations_natural_key');
            $table->index(['unit_level', 'unit_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nominations');
    }
};

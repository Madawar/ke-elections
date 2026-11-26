<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 32);
            $table->string('file', 1024);
            $table->char('sha256', 64);
            $table->unsignedInteger('row_count');
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('unchanged_count')->default(0);
            $table->timestamp('imported_at');
            $table->timestamps();

            $table->index(['kind', 'imported_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_batches');
    }
};

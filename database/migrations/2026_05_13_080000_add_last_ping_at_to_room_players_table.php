<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->timestamp('last_ping_at')->nullable()->after('disconnected_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->dropColumn('last_ping_at');
        });
    }
};

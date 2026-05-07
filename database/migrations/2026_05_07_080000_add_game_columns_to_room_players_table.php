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
            $table->integer('hp')->default(3)->after('status');
            $table->json('active_effect')->nullable()->after('hp');
            $table->timestamp('disconnected_at')->nullable()->after('active_effect');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->dropColumn(['hp', 'active_effect', 'disconnected_at']);
        });
    }
};

<?php

use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\GameController;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Game flow
    Route::inertia('/menu', 'menu')->name('menu');
    Route::post('/rooms', [RoomController::class, 'store'])->name('rooms.store');
    Route::post('/rooms/join', [RoomController::class, 'join'])->name('rooms.join');
    Route::get('/rooms/{code}', [RoomController::class, 'show'])->name('rooms.show');
    Route::post('/rooms/{code}/ready', [RoomController::class, 'toggleReady'])->name('rooms.ready');
    Route::post('/rooms/{code}/leave', [RoomController::class, 'leave'])->name('rooms.leave');
    Route::post('/rooms/{code}/start', [RoomController::class, 'startGame'])->name('rooms.start');
    Route::post('/rooms/{code}/ping', [RoomController::class, 'ping'])->name('rooms.ping');

    // In-game actions
    Route::post('/rooms/{code}/select-power', [GameController::class, 'selectPower'])->name('game.selectPower');
    Route::post('/rooms/{code}/roll', [GameController::class, 'rollDice'])->name('game.roll');
    Route::post('/rooms/{code}/action', [GameController::class, 'executeAction'])->name('game.action');
});

require __DIR__.'/settings.php';

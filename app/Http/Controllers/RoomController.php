<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomPlayer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class RoomController extends Controller
{
    /**
     * Create a new room.
     */
    public function store(Request $request)
    {
        // Require authenticated user (or we could handle guests here)
        $user = $request->user();

        // Generate a unique 6-character room code
        do {
            $code = strtoupper(Str::random(6));
        } while (Room::where('code', $code)->exists());

        // Create the Room
        $room = Room::create([
            'code' => $code,
            'owner_id' => $user->id,
            'max_players' => 4,
            'status' => 'lobby',
            'timer' => 0,
            'game_state' => [],
        ]);

        // Add the creator as the first player
        RoomPlayer::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'is_ready' => false,
            'status' => 'connected',
        ]);

        return redirect()->route('rooms.show', ['code' => $room->code]);
    }

    /**
     * Join an existing room.
     */
    public function join(Request $request)
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $code = strtoupper($request->code);
        $user = $request->user();

        $room = Room::where('code', $code)->first();

        if (!$room) {
            return back()->withErrors(['code' => 'Room not found.']);
        }

        if ($room->status !== 'lobby') {
            return back()->withErrors(['code' => 'Game has already started or ended.']);
        }

        if ($room->players()->count() >= $room->max_players) {
            return back()->withErrors(['code' => 'Room is full.']);
        }

        // Add player if not already in the room
        RoomPlayer::firstOrCreate([
            'room_id' => $room->id,
            'user_id' => $user->id,
        ], [
            'is_ready' => false,
            'status' => 'connected',
        ]);

        return redirect()->route('rooms.show', ['code' => $room->code]);
    }

    /**
     * Display the lobby/room page.
     */
    public function show(Request $request, $code)
    {
        $room = Room::where('code', $code)
            ->with(['owner', 'players.user'])
            ->firstOrFail();

        $user = $request->user();
        
        // Ensure user is in this room
        $isPlayer = $room->players->contains('user_id', $user->id);
        
        if (!$isPlayer) {
            return redirect()->route('menu')->withErrors(['code' => 'You are not a player in this room.']);
        }

        // If game has started, render game board
        if ($room->status === 'in_progress') {
            return Inertia::render('game', [
                'room' => $room,
                'isOwner' => $room->owner_id === $user->id,
                'currentUser' => tap($user)->makeVisible('id'),
            ]);
        }

        return Inertia::render('lobby', [
            'room' => $room,
            'isOwner' => $room->owner_id === $user->id,
            'currentUser' => tap($user)->makeVisible('id'),
        ]);
    }

    /**
     * Toggle player ready status.
     */
    public function toggleReady(Request $request, $code)
    {
        $room = Room::where('code', $code)->firstOrFail();
        $user = $request->user();

        $player = RoomPlayer::where('room_id', $room->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $player->update([
            'is_ready' => !$player->is_ready,
        ]);

        broadcast(new \App\Events\PlayerReadyToggled($room->code, $user->id, $player->is_ready));
        
        return back();
    }

    /**
     * Start the game.
     */
    public function startGame(Request $request, $code)
    {
        $room = Room::where('code', $code)->with('players')->firstOrFail();
        $user = $request->user();

        if ($room->owner_id !== $user->id) {
            return back()->withErrors(['code' => 'Only the owner can start the game.']);
        }

        if ($room->status !== 'lobby') {
            return back()->withErrors(['code' => 'Game is already started.']);
        }

        // Ensure all other players are ready
        $allOthersReady = $room->players->where('user_id', '!=', $user->id)->every('is_ready');
        if (!$allOthersReady || $room->players->count() < 2) {
            return back()->withErrors(['code' => 'Not all players are ready.']);
        }

        // Generate Board
        $tileValues = [];
        $tileTerrains = [];
        $terrains = ['grass', 'mud', 'snow'];
        
        // From prototype.html: for (let i = 1; i <= 100; i++) tileValues[i] = Math.floor(Math.random() * 11);
        $tileValues[0] = 0;
        $tileTerrains[0] = 'grass';
        for ($i = 1; $i <= 100; $i++) {
            $tileValues[$i] = rand(0, 10);
            $tileTerrains[$i] = $terrains[array_rand($terrains)];
        }

        // Initialize players
        $playersState = [];
        $colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899'];
        $index = 0;
        
        foreach ($room->players as $player) {
            $playersState[] = [
                'id' => $player->id,
                'user_id' => $player->user_id,
                'pos' => 1,
                'hp' => 3,
                'alive' => true,
                'color' => $colors[$index % count($colors)],
                'activeEffect' => null
            ];
            $index++;
        }

        // Define snakes and ladders
        $snakes = [98 => 20, 85 => 40, 70 => 30, 50 => 5, 42 => 12];
        $ladders = [3 => 35, 10 => 45, 25 => 60, 55 => 80, 75 => 95];

        $gameState = [
            'currentPlayerIndex' => 0,
            'tileValues' => $tileValues,
            'tileTerrains' => $tileTerrains,
            'players' => $playersState,
            'snakes' => $snakes,
            'ladders' => $ladders,
            'log' => ['Game started!']
        ];

        $room->update([
            'status' => 'in_progress',
            'game_state' => $gameState,
        ]);

        broadcast(new \App\Events\GameStarted($room->code));

        return redirect()->route('rooms.show', ['code' => $room->code]);
    }
}

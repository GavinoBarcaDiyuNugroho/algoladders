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
        $request->validate([
            'max_players' => ['nullable', 'integer', 'min:2', 'max:6'],
        ]);

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
            'max_players' => $request->input('max_players', 4),
            'status' => 'lobby',
            'timer' => 0,
            'game_state' => [],
        ]);

        // Add the creator as the first player
        $roomPlayer = RoomPlayer::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'is_ready' => false,
            'status' => 'connected',
            'last_ping_at' => now(),
        ]);

        \App\Jobs\CheckPlayerTimeoutJob::dispatch($roomPlayer->id)->delay(now()->addSeconds(120));

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

        if (!in_array($room->status, ['lobby', 'finished'])) {
            return back()->withErrors(['code' => 'Game is already in progress.']);
        }

        if ($room->players()->count() >= $room->max_players) {
            return back()->withErrors(['code' => 'Room is full.']);
        }

        // Add player if not already in the room
        $roomPlayer = RoomPlayer::firstOrCreate([
            'room_id' => $room->id,
            'user_id' => $user->id,
        ], [
            'is_ready' => false,
            'status' => 'connected',
            'last_ping_at' => now(),
        ]);
        
        if (!$roomPlayer->wasRecentlyCreated) {
            $roomPlayer->update(['last_ping_at' => now(), 'status' => 'connected']);
        }
        
        \App\Jobs\CheckPlayerTimeoutJob::dispatch($roomPlayer->id)->delay(now()->addSeconds(120));
        $roomPlayer->load('user');
        broadcast(new \App\Events\PlayerJoined($room->code, $roomPlayer));

        return redirect()->route('rooms.show', ['code' => $room->code]);
    }

    /**
     * Leave the room.
     */
    public function leave(Request $request, $code)
    {
        $room = Room::where('code', $code)->firstOrFail();
        $user = $request->user();

        if ($room->status === 'in_progress') {
            // Use forceEliminate to properly advance turn + check win condition
            $gameController = new \App\Http\Controllers\GameController();
            $gameController->forceEliminate($room, $user->id);
            
            // Re-read updated game state for the log message
            $room->refresh();
            $gameState = $room->game_state;
            $gameState['log'][] = $user->name . ' surrendered and left the game.';
            $room->update(['game_state' => $gameState]);
            broadcast(new \App\Events\GameStateUpdated($room->code, $gameState));
            
            // Delete the RoomPlayer row to free them from the room
            RoomPlayer::where('room_id', $room->id)->where('user_id', $user->id)->delete();
            
            // If no players left at all, close the room
            if (RoomPlayer::where('room_id', $room->id)->count() === 0) {
                $room->delete();
                broadcast(new \App\Events\RoomClosed($code));
            }
            
            return redirect()->route('menu');
        }

        if ($room->owner_id === $user->id) {
            // Owner leaves lobby
            RoomPlayer::where('room_id', $room->id)->where('user_id', $user->id)->delete();
            
            // Check if there are other players left
            $nextPlayer = RoomPlayer::where('room_id', $room->id)->orderBy('id')->first();
            
            if ($nextPlayer) {
                // Transfer ownership
                $room->update(['owner_id' => $nextPlayer->user_id]);
                broadcast(new \App\Events\PlayerLeft($code, $user->id, $nextPlayer->user_id));
            } else {
                // No players left -> close room
                $room->delete();
                broadcast(new \App\Events\RoomClosed($code));
            }
            
            return redirect()->route('menu');
        }

        // Regular lobby leave
        RoomPlayer::where('room_id', $room->id)->where('user_id', $user->id)->delete();
        
        broadcast(new \App\Events\PlayerLeft($code, $user->id));
        
        return redirect()->route('menu');
    }

    /**
     * Ping endpoint to update last_ping_at for a player
     */
    public function ping(Request $request, $code)
    {
        $room = Room::where('code', $code)->first();
        if (!$room) return response()->json(['status' => 'not_found'], 404);

        $player = RoomPlayer::where('room_id', $room->id)->where('user_id', $request->user()->id)->first();
        if (!$player) return response()->json(['status' => 'not_found'], 404);

        // If the game is in progress, check if this player is already eliminated in game_state.
        // Eliminated players should NOT be able to ping back to life.
        if ($room->status === 'in_progress') {
            $gameState = $room->game_state;
            if (isset($gameState['players'])) {
                foreach ($gameState['players'] as $p) {
                    if ($p['user_id'] === $player->user_id && !$p['alive']) {
                        return response()->json(['status' => 'eliminated'], 403);
                    }
                }
            }
        }

        $player->update(['last_ping_at' => now()]);

        // If the player was marked disconnected, they are reconnecting.
        // Flip status back and dispatch a NEW timeout watcher.
        if ($player->status === 'disconnected') {
            $player->update(['status' => 'connected']);
            \App\Jobs\CheckPlayerTimeoutJob::dispatch($player->id)->delay(now()->addSeconds(120));
        }

        return response()->json(['status' => 'ok']);
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

        // If game has started or finished, render game board
        if (in_array($room->status, ['in_progress', 'finished'])) {
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
        $room = Room::where('code', $code)->with('players.user')->firstOrFail();
        $user = $request->user();

        if ($room->owner_id !== $user->id) {
            return back()->withErrors(['code' => 'Only the owner can start the game.']);
        }

        if (!in_array($room->status, ['lobby', 'finished'])) {
            return back()->withErrors(['code' => 'Game is already in progress.']);
        }

        // If restarting from a finished game, reset all players first
        if ($room->status === 'finished') {
            // Remove disconnected players so they don't appear as ghosts
            $room->players()->where('status', 'disconnected')->delete();

            $room->players()->update([
                'is_ready' => false,
                'hp' => 3,
                'active_effect' => null,
                'disconnected_at' => null,
                'status' => 'connected',
            ]);
            $room->update(['status' => 'lobby', 'game_state' => null, 'timer_ends_at' => null]);
            broadcast(new \App\Events\RoomRestarted($room->code));
            return redirect()->route('rooms.show', ['code' => $room->code]);
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
        // START tile always has value 0 to prevent multiplication abuse
        $tileValues[1] = 0;

        // Initialize players (shuffle for random turn order)
        $playersState = [];
        $colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899'];
        $index = 0;
        $shuffledPlayers = $room->players->shuffle();

        foreach ($shuffledPlayers as $player) {
            $playersState[] = [
                'id' => $player->id,
                'user_id' => $player->user_id,
                'name' => $player->user->name ?? 'Player ' . $player->id,
                'pos' => 1,
                'hp' => 3,
                'alive' => true,
                'color' => $colors[$index % count($colors)],
                'activeEffect' => null
            ];
            $index++;
        }

        // Generate 5 random snakes and 5 random ladders
        $snakes = [];
        $ladders = [];
        $usedTiles = [1, 100]; // Can't start/end on first or last tile

        // Ladders (Start lower, go higher)
        while (count($ladders) < 5) {
            $start = rand(2, 89);
            $end = rand($start + 10, 99);
            if (!in_array($start, $usedTiles) && !in_array($end, $usedTiles)) {
                $ladders[$start] = $end;
                $usedTiles[] = $start;
                $usedTiles[] = $end;
            }
        }

        // Snakes (Start higher, go lower)
        while (count($snakes) < 5) {
            $start = rand(11, 99);
            $end = rand(2, $start - 10);
            if (!in_array($start, $usedTiles) && !in_array($end, $usedTiles)) {
                $snakes[$start] = $end;
                $usedTiles[] = $start;
                $usedTiles[] = $end;
            }
        }

        $gameState = [
            'currentPlayerIndex' => 0,
            'tileValues' => $tileValues,
            'tileTerrains' => $tileTerrains,
            'players' => $playersState,
            'snakes' => $snakes,
            'ladders' => $ladders,
            'log' => ['Game started!'],
            'phase' => 'select',       // select, roll, action
            'selectedPower' => null,    // math, ifelse, forloop
            'lastRoll' => null,
            'ifelseOptions' => null,
            'status' => 'playing',      // playing, finished
            'winner' => null,
            'rankings' => [],
        ];

        // Set timer_ends_at if owner configured a timer
        $timerInput = (int) $request->input('timer', 0);
        $timerEndsAt = null;
        if ($timerInput > 0) {
            $timerEndsAt = now()->addMinutes($timerInput);
        }

        $room->update([
            'status' => 'in_progress',
            'game_state' => $gameState,
            'timer_ends_at' => $timerEndsAt,
        ]);

        broadcast(new \App\Events\GameStarted($room->code));

        return redirect()->route('rooms.show', ['code' => $room->code]);
    }
}

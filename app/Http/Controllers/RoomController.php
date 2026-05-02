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

        return Inertia::render('lobby', [
            'room' => $room,
            'isOwner' => $room->owner_id === $user->id,
            'currentUser' => tap($user)->makeVisible('id'), // Need ID for current user
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
}

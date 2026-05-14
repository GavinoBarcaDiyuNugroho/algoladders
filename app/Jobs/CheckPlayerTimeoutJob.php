<?php

namespace App\Jobs;

use App\Models\Room;
use App\Models\RoomPlayer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckPlayerTimeoutJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $playerId;

    /**
     * Create a new job instance.
     */
    public function __construct($playerId)
    {
        $this->playerId = $playerId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $player = RoomPlayer::find($this->playerId);

        // If player record doesn't exist anymore, they left normally.
        if (!$player) {
            Log::info("TimeoutJob: Player {$this->playerId} not found (left normally). Stopping.");
            return;
        }

        // If already eliminated, stop the chain.
        if ($player->status === 'disconnected') {
            Log::info("TimeoutJob: Player {$this->playerId} already disconnected/eliminated. Stopping.");
            return;
        }

        $room = Room::find($player->room_id);
        if (!$room || !in_array($room->status, ['lobby', 'in_progress'])) {
            Log::info("TimeoutJob: Room not found or game finished for player {$this->playerId}. Stopping.");
            return;
        }

        // If they have never pinged, treat as immediate timeout
        if (!$player->last_ping_at) {
            Log::warning("TimeoutJob: Player {$this->playerId} has no last_ping_at. Eliminating.");
            $this->eliminatePlayer($player, $room);
            return;
        }

        // Use copy() to avoid mutating the cached Carbon instance
        $lastPing = $player->last_ping_at->copy();
        $diff = $lastPing->diffInSeconds(now());

        Log::info("TimeoutJob: Player {$this->playerId} last_ping_at={$lastPing}, diff={$diff}s");

        if ($diff >= 30) {
            // TIME OUT!
            Log::info("TimeoutJob: Player {$this->playerId} TIMED OUT after {$diff}s. Eliminating.");
            $this->eliminatePlayer($player, $room);
        } else {
            // STILL ACTIVE - Reschedule using integer seconds delay (safest)
            $remainingSeconds = 30 - $diff;
            Log::info("TimeoutJob: Player {$this->playerId} still active. Rescheduling in {$remainingSeconds}s.");
            self::dispatch($this->playerId)->delay(now()->addSeconds($remainingSeconds));
        }
    }

    private function eliminatePlayer(RoomPlayer $player, Room $room): void
    {
        // Handle owner transfer if this player was the owner
        if ($room->owner_id === $player->user_id) {
            $nextPlayer = RoomPlayer::where('room_id', $room->id)
                ->where('user_id', '!=', $player->user_id)
                ->where('status', '!=', 'disconnected')
                ->orderBy('id')
                ->first();
                
            if ($nextPlayer) {
                $room->update(['owner_id' => $nextPlayer->user_id]);
                broadcast(new \App\Events\PlayerLeft($room->code, $player->user_id, $nextPlayer->user_id));
            } else {
                broadcast(new \App\Events\PlayerLeft($room->code, $player->user_id));
            }
        } else {
            broadcast(new \App\Events\PlayerLeft($room->code, $player->user_id));
        }

        if ($room->status === 'in_progress') {
            // Let GameController handle elimination, logging, and advancing turn
            $gameController = new \App\Http\Controllers\GameController();
            $gameController->forceEliminate($room, $player->user_id);
            
            // Keep record but mark status disconnected
            $player->update(['status' => 'disconnected']);
        } else {
            // Lobby state: just delete the player
            $player->delete();
            
            // If no players left, delete room
            if (RoomPlayer::where('room_id', $room->id)->count() === 0) {
                $room->delete();
                broadcast(new \App\Events\RoomClosed($room->code));
            }
        }
    }
}

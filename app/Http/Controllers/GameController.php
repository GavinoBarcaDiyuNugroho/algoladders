<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomPlayer;
use Illuminate\Http\Request;

class GameController extends Controller
{
    /**
     * Select a powerup (math, ifelse, forloop).
     */
    public function selectPower(Request $request, $code)
    {
        $request->validate(['power' => 'required|in:math,ifelse,forloop']);

        $room = Room::where('code', $code)->firstOrFail();
        $user = $request->user();
        $gameState = $room->game_state;

        $currentPlayer = $gameState['players'][$gameState['currentPlayerIndex']] ?? null;
        if (!$currentPlayer || $currentPlayer['user_id'] !== $user->id) {
            return back()->withErrors(['game' => 'Not your turn.']);
        }

        $gameState['phase'] = 'roll';
        $gameState['selectedPower'] = $request->power;

        // If-Else: generate random options for the player
        if ($request->power === 'ifelse') {
            $gameState['ifelseOptions'] = $this->generateIfElseOptions();
        }

        $gameState['log'][] = ($currentPlayer['name'] ?? 'Player') . ' selected ' . strtoupper($request->power) . '.';

        $room->update(['game_state' => $gameState]);
        broadcast(new \App\Events\GameStateUpdated($room->code, $gameState));
        return back();
    }

    /**
     * Roll the dice (server-side RNG).
     */
    public function rollDice(Request $request, $code)
    {
        $room = Room::where('code', $code)->firstOrFail();
        $user = $request->user();
        $gameState = $room->game_state;

        $currentPlayer = $gameState['players'][$gameState['currentPlayerIndex']] ?? null;
        if (!$currentPlayer || $currentPlayer['user_id'] !== $user->id) {
            return back()->withErrors(['game' => 'Not your turn.']);
        }
        if (($gameState['phase'] ?? '') !== 'roll') {
            return back()->withErrors(['game' => 'Cannot roll now.']);
        }

        $roll = rand(1, 6);
        $gameState['lastRoll'] = $roll;
        $gameState['phase'] = 'action';
        $gameState['log'][] = ($currentPlayer['name'] ?? 'Player') . ' rolled a ' . $roll . '!';

        $room->update(['game_state' => $gameState]);
        broadcast(new \App\Events\GameStateUpdated($room->code, $gameState));
        return back();
    }

    /**
     * Execute the chosen action (Math operator, For-Loop confirm, If-Else compile).
     */
    public function executeAction(Request $request, $code)
    {
        $room = Room::where('code', $code)->firstOrFail();
        $user = $request->user();
        $gameState = $room->game_state;

        $idx = $gameState['currentPlayerIndex'];
        $currentPlayer = $gameState['players'][$idx] ?? null;
        if (!$currentPlayer || $currentPlayer['user_id'] !== $user->id) {
            return back()->withErrors(['game' => 'Not your turn.']);
        }
        if (($gameState['phase'] ?? '') !== 'action') {
            return back()->withErrors(['game' => 'Cannot act now.']);
        }

        $power = $gameState['selectedPower'] ?? 'math';
        $roll = $gameState['lastRoll'] ?? 1;
        $pos = $currentPlayer['pos'];
        $tileVal = $gameState['tileValues'][$pos] ?? 0;

        // Store old position for all players BEFORE movement (needed for passed_me trap check)
        $oldPositions = [];
        foreach ($gameState['players'] as $pi => $pl) {
            $oldPositions[$pi] = $pl['pos'];
        }
        $gameState['_oldPositions'] = $oldPositions;

        if ($power === 'math') {
            $gameState = $this->executeMath($request, $gameState, $idx, $roll, $tileVal);
        } elseif ($power === 'forloop') {
            $gameState = $this->executeForLoop($gameState, $idx, $roll, $tileVal);
        } elseif ($power === 'ifelse') {
            $gameState = $this->executeIfElse($request, $gameState, $idx, $roll);
        }

        // Check win condition
        $gameState = $this->checkWinCondition($gameState, $room);

        // Advance turn if game is still going
        if ($gameState['status'] ?? 'playing' === 'playing') {
            $gameState = $this->advanceTurn($gameState);
        }

        // Clean up phase state
        $gameState['phase'] = 'select';
        $gameState['selectedPower'] = null;
        $gameState['lastRoll'] = null;
        $gameState['ifelseOptions'] = null;
        unset($gameState['_oldPositions']);

        $room->update(['game_state' => $gameState]);
        broadcast(new \App\Events\GameStateUpdated($room->code, $gameState));
        return back();
    }

    // ─── MATH ────────────────────────────────────────────────────────────────────

    private function executeMath(Request $request, array $gs, int $idx, int $roll, int $tileVal): array
    {
        $op = $request->input('operator', '+');
        $player = &$gs['players'][$idx];
        $pos = $player['pos'];
        $movement = 0;

        switch ($op) {
            case '+':
                $movement = $roll + $tileVal;
                break;
            case '-':
                $movement = $roll - $tileVal;
                break;
            case '*':
                $result = $roll * $tileVal;
                if ($pos + $result > 100) {
                    $gs['log'][] = $player['name'] . ' used × but result exceeds 100. Staying put!';
                    return $gs;
                }
                $movement = $result;
                break;
            case '/':
                if ($tileVal === 0) {
                    $gs['log'][] = $player['name'] . ' tried ÷ by 0! No movement.';
                    return $gs;
                }
                $movement = intdiv($roll, $tileVal);
                break;
        }

        $gs['log'][] = $player['name'] . " used {$roll} {$op} {$tileVal} = " . ($roll) . "{$op}{$tileVal} → moved {$movement} tiles.";

        $newPos = $pos + $movement;
        if ($newPos < 1) $newPos = 1;
        if ($newPos > 100) $newPos = 100;

        $player['pos'] = $newPos;

        // Check snake/ladder on final tile
        $gs = $this->resolveSnakeLadder($gs, $idx);
        // Check combat (stepping on another player)
        $gs = $this->resolveCombat($gs, $idx);

        return $gs;
    }

    // ─── FOR LOOP ────────────────────────────────────────────────────────────────

    private function executeForLoop(array $gs, int $idx, int $roll, int $tileVal): array
    {
        $player = &$gs['players'][$idx];
        $loops = min($tileVal, 3);
        if ($loops <= 0) $loops = 1;

        $gs['log'][] = $player['name'] . " activates FOR LOOP: {$loops} iteration(s) of {$roll} tiles each.";

        for ($i = 0; $i < $loops; $i++) {
            $newPos = $player['pos'] + $roll;
            if ($newPos > 100) $newPos = 100;
            if ($newPos < 1) $newPos = 1;
            $player['pos'] = $newPos;

            // Combat triggers every step
            $gs = $this->resolveCombat($gs, $idx);

            $gs['log'][] = "  Loop " . ($i + 1) . ": moved to tile {$player['pos']}.";
        }

        // Snake/Ladder ONLY on final tile
        $gs = $this->resolveSnakeLadder($gs, $idx);

        return $gs;
    }

    // ─── IF-ELSE ─────────────────────────────────────────────────────────────────

    private function executeIfElse(Request $request, array $gs, int $idx, int $roll): array
    {
        $player = &$gs['players'][$idx];
        $condition = $request->input('condition');
        $thenOutput = $request->input('then_output');
        $elseOutput = $request->input('else_output');

        // First: move by dice roll amount
        $newPos = $player['pos'] + $roll;
        if ($newPos > 100) $newPos = 100;
        if ($newPos < 1) $newPos = 1;
        $player['pos'] = $newPos;

        $gs['log'][] = $player['name'] . " moved {$roll} tiles to position {$player['pos']}.";

        // Check if the condition is immediately met
        $condMet = $this->checkIfElseCondition($gs, $idx, $condition);

        if ($condMet) {
            $gs['log'][] = "IF condition [{$condition}] is TRUE! Executing THEN...";
            $gs = $this->applyIfElseOutput($gs, $idx, $thenOutput, $roll);
        } else {
            // Store as active trap until next turn
            $player['activeEffect'] = [
                'condition' => $condition,
                'then' => $thenOutput,
                'else' => $elseOutput,
                'roll' => $roll,
            ];
            $gs['log'][] = $player['name'] . " set IF-ELSE trap: [{$condition}]. Active until next turn.";
        }

        // Resolve snake/ladder after movement
        if (!$condMet || $condition !== 'snake') {
            $gs = $this->resolveSnakeLadder($gs, $idx);
        }
        $gs = $this->resolveCombat($gs, $idx);

        return $gs;
    }

    private function checkIfElseCondition(array $gs, int $idx, string $condition): bool
    {
        $player = $gs['players'][$idx];
        switch ($condition) {
            case 'snake':
                return isset($gs['snakes'][$player['pos']]);
            case 'passed_me':
                return false; // Can't be immediately true on your own turn
            case 'stepped_on_me':
                return false; // Can't be immediately true on your own turn
            case 'stepped_on_other':
                foreach ($gs['players'] as $i => $p) {
                    if ($i !== $idx && $p['alive'] && $p['pos'] === $player['pos']) return true;
                }
                return false;
        }
        return false;
    }

    /**
     * Check active If-Else traps for ALL players when someone moves.
     */
    public static function checkActiveTraps(array &$gs, int $movingIdx): void
    {
        $movingPlayer = $gs['players'][$movingIdx];
        $oldPositions = $gs['_oldPositions'] ?? [];
        $moverOldPos = $oldPositions[$movingIdx] ?? $movingPlayer['pos'];

        foreach ($gs['players'] as $i => &$p) {
            if ($i === $movingIdx || !$p['alive'] || !$p['activeEffect']) continue;

            $effect = $p['activeEffect'];
            $triggered = false;

            switch ($effect['condition']) {
                case 'passed_me':
                    // The mover must have been BEHIND the trap owner before,
                    // and now be AT or AHEAD of the trap owner after moving.
                    if ($moverOldPos < $p['pos'] && $movingPlayer['pos'] >= $p['pos']) {
                        $triggered = true;
                    }
                    break;
                case 'stepped_on_me':
                    if ($movingPlayer['pos'] === $p['pos']) {
                        $triggered = true;
                    }
                    break;
            }

            if ($triggered) {
                $gs['log'][] = "⚡ " . $p['name'] . "'s IF-ELSE trap triggered! Condition [{$effect['condition']}] met.";
                $gs = self::applyIfElseOutputStatic($gs, $i, $effect['then'], $effect['roll']);
                $p['activeEffect'] = null;
            }
        }
    }

    /**
     * Expire If-Else trap at the start of a player's turn (Else branch).
     */
    private function expireIfElseTrap(array &$gs, int $idx): void
    {
        $player = &$gs['players'][$idx];
        if (!$player['activeEffect']) return;

        $effect = $player['activeEffect'];
        $gs['log'][] = $player['name'] . "'s IF-ELSE trap expired. ELSE condition activating...";
        $gs = $this->applyIfElseOutput($gs, $idx, $effect['else'], $effect['roll']);
        $player['activeEffect'] = null;
    }

    private function applyIfElseOutput(array $gs, int $idx, string $output, int $roll): array
    {
        return self::applyIfElseOutputStatic($gs, $idx, $output, $roll);
    }

    private static function applyIfElseOutputStatic(array $gs, int $idx, string $output, int $roll): array
    {
        $player = &$gs['players'][$idx];

        switch ($output) {
            case 'move_rand':
                $amount = rand(1, 10);
                $player['pos'] = min(100, $player['pos'] + $amount);
                $gs['log'][] = "  → {$player['name']} moves forward {$amount} tiles!";
                break;
            case 'move_dice':
                $player['pos'] = min(100, $player['pos'] + $roll);
                $gs['log'][] = "  → {$player['name']} moves forward {$roll} tiles (dice)!";
                break;
            case 'kick_rand':
                $amount = rand(1, 10);
                // Kick the closest opponent backward
                $closestIdx = self::findClosestOpponent($gs, $idx);
                if ($closestIdx !== null) {
                    $gs['players'][$closestIdx]['pos'] = max(1, $gs['players'][$closestIdx]['pos'] - $amount);
                    $gs['log'][] = "  → Kicked " . $gs['players'][$closestIdx]['name'] . " back {$amount} tiles!";
                }
                break;
            case 'kick_start':
                $closestIdx = self::findClosestOpponent($gs, $idx);
                if ($closestIdx !== null) {
                    $gs['players'][$closestIdx]['pos'] = 1;
                    $gs['players'][$closestIdx]['hp'] -= 1;
                    $gs['log'][] = "  → Kicked " . $gs['players'][$closestIdx]['name'] . " back to START! (-1 HP)";
                    if ($gs['players'][$closestIdx]['hp'] <= 0) {
                        $gs['players'][$closestIdx]['alive'] = false;
                        $gs['log'][] = "  💀 " . $gs['players'][$closestIdx]['name'] . " has been ELIMINATED!";
                    }
                }
                break;
            case 'teleport_ladder':
                $nearest = self::findNearestLadder($gs, $player['pos']);
                if ($nearest && isset($gs['ladders'][$nearest])) {
                    $dest = $gs['ladders'][$nearest];
                    $gs['log'][] = "  → {$player['name']} teleported to ladder at tile {$nearest} and climbed to tile {$dest}!";
                    $player['pos'] = $dest;
                }
                break;
            case 'stay':
                $gs['log'][] = "  → {$player['name']} stays on their tile.";
                break;
            case 'back_rand':
                $amount = rand(1, 10);
                $player['pos'] = max(1, $player['pos'] - $amount);
                $gs['log'][] = "  → {$player['name']} moves backward {$amount} tiles!";
                break;
            case 'teleport_snake':
                $nearest = self::findNearestSnake($gs, $player['pos']);
                if ($nearest && isset($gs['snakes'][$nearest])) {
                    $dest = $gs['snakes'][$nearest];
                    $gs['log'][] = "  → {$player['name']} teleported to snake at tile {$nearest} and slid down to tile {$dest}!";
                    $player['pos'] = $dest;
                }
                break;
            case 'back_start':
                $player['pos'] = 1;
                $player['hp'] -= 1;
                $gs['log'][] = "  → {$player['name']} sent back to START! (-1 HP)";
                if ($player['hp'] <= 0) {
                    $player['alive'] = false;
                    $gs['log'][] = "  💀 {$player['name']} has been ELIMINATED!";
                }
                break;
            case 'back_dice':
                $player['pos'] = max(1, $player['pos'] - $roll);
                $gs['log'][] = "  → {$player['name']} moves backward {$roll} tiles (dice)!";
                break;
        }

        return $gs;
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────────────

    private function resolveSnakeLadder(array $gs, int $idx): array
    {
        $player = &$gs['players'][$idx];
        $pos = $player['pos'];

        if (isset($gs['snakes'][$pos])) {
            $dest = $gs['snakes'][$pos];
            $gs['log'][] = "🐍 {$player['name']} landed on a SNAKE! Sliding from {$pos} to {$dest}.";
            $player['pos'] = $dest;
        } elseif (isset($gs['ladders'][$pos])) {
            $dest = $gs['ladders'][$pos];
            $gs['log'][] = "🪜 {$player['name']} found a LADDER! Climbing from {$pos} to {$dest}!";
            $player['pos'] = $dest;
        }

        return $gs;
    }

    private function resolveCombat(array $gs, int $idx): array
    {
        $player = &$gs['players'][$idx];

        // Check active traps FIRST (before combat changes positions)
        // This ensures "stepped_on_me" can detect the overlap before the victim is kicked away
        self::checkActiveTraps($gs, $idx);

        // Then resolve combat (kicking players to start)
        foreach ($gs['players'] as $i => &$other) {
            if ($i === $idx || !$other['alive'] || ($other['finished'] ?? false)) continue;
            if ($other['pos'] === $player['pos']) {
                $gs['log'][] = "⚔️ {$player['name']} stomped on {$other['name']}! Kicked to START!";
                $other['pos'] = 1;
                $other['hp'] -= 1;
                if ($other['hp'] <= 0) {
                    $other['alive'] = false;
                    $gs['log'][] = "💀 {$other['name']} has been ELIMINATED!";
                }
            }
        }

        return $gs;
    }

    private function advanceTurn(array $gs): array
    {
        $numPlayers = count($gs['players']);
        $nextIdx = ($gs['currentPlayerIndex'] + 1) % $numPlayers;

        // Skip dead or already-finished players
        $attempts = 0;
        while ($attempts < $numPlayers) {
            $p = $gs['players'][$nextIdx];
            if ($p['alive'] && !($p['finished'] ?? false)) break;
            $nextIdx = ($nextIdx + 1) % $numPlayers;
            $attempts++;
        }

        $gs['currentPlayerIndex'] = $nextIdx;

        // Expire any If-Else trap on the new player's turn
        $this->expireIfElseTrap($gs, $nextIdx);

        return $gs;
    }

    private function checkWinCondition(array $gs, Room $room): array
    {
        // Initialize rankings array if not present
        if (!isset($gs['rankings'])) {
            $gs['rankings'] = [];
        }

        // Check if any player just reached tile 100 — mark them as finished with a rank
        foreach ($gs['players'] as $i => &$p) {
            if ($p['alive'] && !($p['finished'] ?? false) && $p['pos'] >= 100) {
                $place = count($gs['rankings']) + 1;
                $p['finished'] = true;
                $p['place'] = $place;
                $gs['rankings'][] = ['name' => $p['name'], 'place' => $place];

                $suffix = match($place) { 1 => 'st', 2 => 'nd', 3 => 'rd', default => 'th' };
                $gs['log'][] = "🏁 {$p['name']} crossed the FINISH LINE in {$place}{$suffix} place!";
            }
        }

        // Count players still racing (alive AND not finished)
        $stillRacing = array_filter($gs['players'], fn($p) => $p['alive'] && !($p['finished'] ?? false));

        // Game ends when no one is left racing
        if (count($stillRacing) === 0) {
            // Add any alive-but-unfinished players (eliminated mid-race) with their position
            $gs['status'] = 'finished';
            $gs['winner'] = $gs['rankings'][0]['name'] ?? null;
            $gs['log'][] = "🏆 Game Over! " . ($gs['winner'] ? $gs['winner'] . " wins!" : "No winner!");
            $room->update(['status' => 'finished']);
            return $gs;
        }

        // If only 1 player is still racing and at least 1 has already finished, auto-finish them as last
        if (count($stillRacing) === 1 && count($gs['rankings']) > 0) {
            $lastPlayer = array_values($stillRacing)[0];
            // Let them keep playing — they can still finish naturally
        }

        // Check if only one alive player remains (everyone else eliminated/surrendered, none finished yet)
        $alivePlayers = array_filter($gs['players'], fn($p) => $p['alive']);
        if (count($alivePlayers) === 1 && count($gs['rankings']) === 0) {
            $winner = array_values($alivePlayers)[0];
            $gs['status'] = 'finished';
            $gs['winner'] = $winner['name'];
            $gs['rankings'][] = ['name' => $winner['name'], 'place' => 1];
            $gs['log'][] = "🏆 {$winner['name']} is the last player standing! WINNER!";
            $room->update(['status' => 'finished']);
            return $gs;
        }

        if (count($alivePlayers) === 0) {
            $gs['status'] = 'finished';
            $gs['winner'] = $gs['rankings'][0]['name'] ?? null;
            $gs['log'][] = "All remaining players eliminated. Game Over!";
            $room->update(['status' => 'finished']);
            return $gs;
        }

        // Timer check
        if ($room->timer_ends_at && now()->gte($room->timer_ends_at)) {
            // Rank remaining players by position
            $remaining = array_filter($gs['players'], fn($p) => $p['alive'] && !($p['finished'] ?? false));
            usort($remaining, fn($a, $b) => $b['pos'] - $a['pos']);
            foreach ($remaining as $rp) {
                $place = count($gs['rankings']) + 1;
                $gs['rankings'][] = ['name' => $rp['name'], 'place' => $place];
            }
            $gs['status'] = 'finished';
            $gs['winner'] = $gs['rankings'][0]['name'] ?? null;
            $gs['log'][] = "⏰ Time's up! Game Over!";
            $room->update(['status' => 'finished']);
        }

        return $gs;
    }

    private function generateIfElseOptions(): array
    {
        $allConditions = [
            ['id' => 'snake', 'text' => 'If I step on a snake'],
            ['id' => 'passed_me', 'text' => 'If another player passes me'],
            ['id' => 'stepped_on_me', 'text' => 'If another player steps on me'],
            ['id' => 'stepped_on_other', 'text' => 'If I step on another player'],
        ];

        $allPositive = [
            ['id' => 'move_rand', 'text' => 'Move forward 1-10 tiles (random)'],
            ['id' => 'move_dice', 'text' => 'Move forward by dice roll'],
            ['id' => 'kick_rand', 'text' => 'Kick nearest player back 1-10 tiles'],
            ['id' => 'kick_start', 'text' => 'Kick nearest player to start'],
            ['id' => 'teleport_ladder', 'text' => 'Teleport to nearest ladder'],
        ];

        $allNegative = [
            ['id' => 'back_rand', 'text' => 'Move backward 1-10 tiles (random)'],
            ['id' => 'teleport_snake', 'text' => 'Teleport to nearest snake'],
            ['id' => 'back_start', 'text' => 'Move back to start'],
            ['id' => 'back_dice', 'text' => 'Move backward by dice roll'],
        ];

        $neutral = [
            ['id' => 'stay', 'text' => 'Stay on my tile'],
        ];

        // Pick 3 random conditions, 2 positive, 2 negative, all neutral
        shuffle($allConditions);
        shuffle($allPositive);
        shuffle($allNegative);

        return [
            'conditions' => array_slice($allConditions, 0, 3),
            'positive' => array_slice($allPositive, 0, 2),
            'negative' => array_slice($allNegative, 0, 2),
            'neutral' => $neutral,
        ];
    }

    private static function findClosestOpponent(array $gs, int $idx): ?int
    {
        $myPos = $gs['players'][$idx]['pos'];
        $closest = null;
        $minDist = PHP_INT_MAX;

        foreach ($gs['players'] as $i => $p) {
            if ($i === $idx || !$p['alive']) continue;
            $dist = abs($p['pos'] - $myPos);
            if ($dist < $minDist) {
                $minDist = $dist;
                $closest = $i;
            }
        }

        return $closest;
    }

    private static function findNearestLadder(array $gs, int $pos): ?int
    {
        $nearest = null;
        $minDist = PHP_INT_MAX;
        foreach ($gs['ladders'] as $start => $end) {
            if (abs($start - $pos) < $minDist) {
                $minDist = abs($start - $pos);
                $nearest = $start;
            }
        }
        return $nearest;
    }

    private static function findNearestSnake(array $gs, int $pos): ?int
    {
        $nearest = null;
        $minDist = PHP_INT_MAX;
        foreach ($gs['snakes'] as $head => $tail) {
            if (abs($head - $pos) < $minDist) {
                $minDist = abs($head - $pos);
                $nearest = $head;
            }
        }
        return $nearest;
    }
}

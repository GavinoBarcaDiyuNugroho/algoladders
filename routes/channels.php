<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('room.{code}', function ($user, $code) {
    // Only allow users who are actually in the room to join the presence channel
    $room = \App\Models\Room::where('code', $code)->first();
    if ($room && $room->players()->where('user_id', $user->id)->exists()) {
        return [
            'id' => $user->id,
            'name' => $user->name,
        ];
    }
    return false;
});

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'code',
        'owner_id',
        'max_players',
        'status',
        'timer',
        'game_state',
    ];

    protected $casts = [
        'game_state' => 'array',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function players()
    {
        return $this->hasMany(RoomPlayer::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoomPlayer extends Model
{
    protected $fillable = [
        'room_id',
        'user_id',
        'is_ready',
        'status',
        'hp',
        'active_effect',
        'disconnected_at',
    ];

    protected $casts = [
        'is_ready' => 'boolean',
        'active_effect' => 'array',
        'disconnected_at' => 'datetime',
    ];

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

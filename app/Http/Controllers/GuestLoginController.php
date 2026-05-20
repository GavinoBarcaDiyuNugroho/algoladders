<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class GuestLoginController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:20',
        ]);

        $guest = User::create([
            'name' => $request->name,
            'email' => 'guest_' . Str::random(10) . '@algoladders.local',
            'password' => Hash::make(Str::random(16)),
        ]);

        Auth::login($guest);

        return redirect()->route('menu');
    }
}

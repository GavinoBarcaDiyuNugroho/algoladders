import { Head, router } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Users, Crown, CheckCircle2, Circle, Copy, Check } from 'lucide-react';
import { useEchoPresence, echo } from '@laravel/echo-react';

interface Player {
    id: number;
    user_id: number;
    is_ready: boolean;
    user: {
        id: number;
        name: string;
    };
}

interface Room {
    id: number;
    code: string;
    owner_id: number;
    max_players: number;
    players: Player[];
}

export default function Lobby({ room, isOwner, currentUser }: { room: Room, isOwner: boolean, currentUser: { id: number; name: string } }) {
    const [players, setPlayers] = useState<Player[]>(room.players);
    const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
    const [codeCopied, setCodeCopied] = useState(false);

    // Use the echo-react presence hook for the PlayerReadyToggled event
    const { channel } = useEchoPresence(
        `room.${room.code}`,
        'PlayerReadyToggled',
        (e: any) => {
            setPlayers(prevPlayers => prevPlayers.map(p => {
                if (p.user_id === e.userId) {
                    return { ...p, is_ready: e.isReady };
                }
                return p;
            }));
        },
        [room.code],
    );

    // Subscribe to presence events (here/joining/leaving) via the channel
    useEffect(() => {
        const ch = channel();
        if (!ch) return;

        ch.here((users: any[]) => {
            setOnlineUsers(users.map((u: any) => u.id));
        });

        ch.joining((user: any) => {
            setOnlineUsers(prev => [...prev, user.id]);
            // Reload room data to get the newly joined player
            router.reload({ only: ['room'] });
        });

        ch.leaving((user: any) => {
            setOnlineUsers(prev => prev.filter(id => id !== user.id));
        });
    }, [channel]);

    // Update local state when Inertia reloads the page props
    useEffect(() => {
        setPlayers(room.players);
    }, [room.players]);

    const toggleReady = () => {
        router.post(`/rooms/${room.code}/ready`, {}, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const startGame = () => {
        // Phase 3 — will handle game start
        console.log('Start game clicked');
    };

    const copyCode = useCallback(() => {
        navigator.clipboard.writeText(room.code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    }, [room.code]);

    const me = players.find(p => p.user_id === currentUser.id);
    const allOthersReady = players.filter(p => p.user_id !== room.owner_id).every(p => p.is_ready);
    const canStart = allOthersReady && players.length >= 2;

    // Player colors for avatars
    const playerColors = [
        'from-indigo-400 to-violet-500',
        'from-rose-400 to-red-500',
        'from-emerald-400 to-teal-500',
        'from-amber-400 to-orange-500',
    ];

    return (
        <>
            <Head title={`Lobby ${room.code} - Algo Ladders`} />
            <div className="relative min-h-screen bg-background text-foreground flex flex-col p-4 md:p-8">
                
                {/* Animated Background */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} transition={{ duration: 1.5 }}
                        className="absolute w-[700px] h-[700px] bg-primary rounded-full blur-[150px] top-[-300px] right-[-200px]"
                    />
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 0.06 }} transition={{ duration: 1.5, delay: 0.5 }}
                        className="absolute w-[500px] h-[500px] bg-secondary rounded-full blur-[120px] bottom-[-200px] left-[-100px]"
                    />
                </div>

                <div className="relative z-10 max-w-5xl w-full mx-auto flex flex-col min-h-[calc(100vh-4rem)] gap-6">
                    {/* Header */}
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/80 backdrop-blur-md p-6 rounded-3xl border border-border shadow-lg"
                    >
                        <div>
                            <h1 className="text-3xl font-black italic tracking-tighter">
                                ALGO<span className="text-primary">LADDERS</span> <span className="text-muted-foreground font-medium text-xl">LOBBY</span>
                            </h1>
                            <p className="text-muted-foreground font-medium mt-1">
                                {players.length < room.max_players 
                                    ? 'Waiting for players to join...' 
                                    : 'Room is full! Ready up to start.'}
                            </p>
                        </div>
                        <button 
                            onClick={copyCode}
                            className="flex items-center gap-3 bg-background px-6 py-3 rounded-xl border border-input hover:border-primary/50 transition-colors cursor-pointer group"
                        >
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ROOM CODE</span>
                            <span className="text-2xl font-mono font-black text-secondary tracking-widest">{room.code}</span>
                            {codeCopied ? (
                                <Check className="w-5 h-5 text-green-500" />
                            ) : (
                                <Copy className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            )}
                        </button>
                    </motion.div>

                    {/* Players Grid */}
                    <div className="flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Render actual players */}
                            {players.map((player, index) => {
                                const isOnline = onlineUsers.includes(player.user_id);
                                const isMe = player.user_id === currentUser.id;
                                const isRoomOwner = player.user_id === room.owner_id;

                                return (
                                    <motion.div 
                                        key={player.id}
                                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: index * 0.1 }}
                                        className={`relative bg-card border-2 p-6 rounded-3xl shadow-sm flex flex-col items-center text-center gap-4 transition-all duration-300 ${
                                            isMe ? 'border-primary/60 shadow-primary/10 shadow-lg' : 'border-border hover:border-border/80'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative">
                                            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${playerColors[index % playerColors.length]} flex items-center justify-center text-3xl font-bold text-white uppercase shadow-md`}>
                                                {player.user.name.substring(0, 2)}
                                            </div>
                                            {isRoomOwner && (
                                                <motion.div 
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: 'spring', stiffness: 500, delay: 0.3 }}
                                                    className="absolute -top-3 -right-3 w-8 h-8 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center shadow-lg" 
                                                    title="Room Owner"
                                                >
                                                    <Crown className="w-4 h-4" />
                                                </motion.div>
                                            )}
                                            <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-[3px] border-card transition-colors ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={isOnline ? 'Online' : 'Offline'} />
                                        </div>
                                        
                                        {/* Name */}
                                        <div className="w-full">
                                            <h3 className="font-bold text-base truncate px-1">{player.user.name}</h3>
                                            {isMe && <span className="text-[10px] font-bold text-primary uppercase tracking-widest">You</span>}
                                        </div>

                                        {/* Ready Badge */}
                                        <motion.div 
                                            animate={player.is_ready ? { scale: [1, 1.05, 1] } : {}}
                                            transition={{ duration: 0.3 }}
                                            className={`w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                                                player.is_ready 
                                                    ? 'bg-green-500/15 text-green-600' 
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            {player.is_ready ? (
                                                <><CheckCircle2 className="w-3.5 h-3.5" /> READY</>
                                            ) : (
                                                <><Circle className="w-3.5 h-3.5" /> WAITING</>
                                            )}
                                        </motion.div>
                                    </motion.div>
                                );
                            })}

                            {/* Empty Slots */}
                            {Array.from({ length: room.max_players - players.length }).map((_, i) => (
                                <motion.div 
                                    key={`empty-${i}`} 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: players.length * 0.1 + i * 0.1 }}
                                    className="bg-card/30 border-2 border-dashed border-border/40 p-6 rounded-3xl flex flex-col items-center justify-center text-center gap-4"
                                >
                                    <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center">
                                        <Users className="w-8 h-8 text-muted-foreground/30" />
                                    </div>
                                    <span className="font-semibold text-muted-foreground/40 uppercase tracking-widest text-xs">Open Slot</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Action Footer */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="bg-card/80 backdrop-blur-md p-5 rounded-3xl border border-border shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4"
                    >
                        <div className="text-muted-foreground font-medium flex items-center gap-2 text-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                            {onlineUsers.length} / {room.max_players} Players Online
                        </div>
                        
                        <div className="flex gap-3 w-full sm:w-auto">
                            {!isOwner && (
                                <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={toggleReady}
                                    className={`flex-1 sm:flex-none px-8 py-3.5 font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm ${
                                        me?.is_ready 
                                            ? 'bg-card text-foreground border-2 border-border hover:bg-muted' 
                                            : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/40'
                                    }`}
                                >
                                    {me?.is_ready ? (
                                        <><Circle className="w-4 h-4" /> CANCEL READY</>
                                    ) : (
                                        <><CheckCircle2 className="w-4 h-4" /> I AM READY</>
                                    )}
                                </motion.button>
                            )}

                            {isOwner && (
                                <motion.button 
                                    whileHover={canStart ? { scale: 1.02 } : {}}
                                    whileTap={canStart ? { scale: 0.98 } : {}}
                                    onClick={startGame}
                                    disabled={!canStart}
                                    className="flex-1 sm:flex-none px-8 py-3.5 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/90 transition-all shadow-md hover:shadow-secondary/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    START GAME
                                </motion.button>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </>
    );
}

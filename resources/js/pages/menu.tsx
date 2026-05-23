import { Head, Link, router, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Hash, ArrowLeft, XCircle, Settings, X, Volume2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSoundEffects } from '../hooks/useSoundEffects';

export default function Menu() {
    const { errors, auth } = usePage().props as any;
    const [joinCode, setJoinCode] = useState('');
    const [maxPlayers, setMaxPlayers] = useState('4');
    const [showError, setShowError] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const { playSfx, playBgm, stopBgm, bgmVolume, setBgmVolume, sfxVolume, setSfxVolume } = useSoundEffects();

    // Play lobby BGM
    useEffect(() => {
        playBgm('lobby');
        return () => stopBgm();
    }, [playBgm, stopBgm]);

    useEffect(() => {
        if (errors && errors.code) {
            setShowError(true);
        }
    }, [errors]);

    const handleCreateGame = () => {
        playSfx('click');
        router.post('/rooms', { max_players: parseInt(maxPlayers) });
    };

    const handleJoinGame = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinCode.trim()) {
            playSfx('click');
            router.post(`/rooms/join`, { code: joinCode.toUpperCase() });
        }
    };

    return (
        <>
            <Head title="Game Menu - Algo Ladders" />
            <div className="dark relative min-h-screen overflow-hidden bg-background text-foreground flex flex-col items-center justify-center p-6">
                
                <AnimatePresence>
                    {showError && errors?.code && (
                        <motion.div 
                            initial={{ opacity: 0, y: -50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -50 }}
                            className="absolute top-6 z-50 bg-red-500/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-red-400"
                        >
                            <XCircle className="w-6 h-6" />
                            <div className="flex flex-col">
                                <span className="font-bold text-lg">Oops!</span>
                                <span className="text-sm font-medium">{errors.code}</span>
                            </div>
                            <button onClick={() => setShowError(false)} className="ml-4 hover:bg-white/20 p-1 rounded-full transition">
                                <XCircle className="w-5 h-5 opacity-70" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Simple Animated Background */}
                <div className="absolute inset-0 z-0 overflow-hidden opacity-10 pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1 }}
                        className="absolute w-[500px] h-[500px] bg-primary rounded-full blur-[100px] top-[-100px] left-[-100px]"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="absolute w-[400px] h-[400px] bg-secondary rounded-full blur-[80px] bottom-[-50px] right-[-50px]"
                    />
                </div>

                <div className="absolute top-6 left-6 z-20">
                    <Link href="/" onClick={() => playSfx('click')} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-semibold bg-card/80 p-3 rounded-full shadow-sm backdrop-blur-md">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="sr-only sm:not-sr-only sm:pr-2">Back to Title</span>
                    </Link>
                </div>

                {/* Main Content */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center"
                >
                    <div className="space-y-6 text-center md:text-left">
                        <motion.h1 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-4xl md:text-6xl font-black italic tracking-tighter"
                        >
                            GAME <span className="text-secondary">MENU</span>
                        </motion.h1>
                        <p className="text-muted-foreground text-lg font-medium max-w-md mx-auto md:mx-0">
                            {auth?.user?.is_guest 
                                ? "Enter a room code to join an existing session." 
                                : "Create a new room to invite friends, or enter a code to join an existing session."
                            }
                        </p>
                    </div>

                    <div className="grid gap-6">
                        {/* Create Game Card */}
                        {!auth?.user?.is_guest && (
                            <motion.div 
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="bg-card/80 backdrop-blur-md border border-border p-8 rounded-3xl shadow-xl flex flex-col items-center text-center space-y-4 hover:border-primary/50 transition-colors group"
                            >
                                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Plus className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">Create Room</h2>
                                    <p className="text-muted-foreground text-sm mt-1">Host a new game and invite players.</p>
                                </div>
                                
                                <div className="w-full mt-2 flex items-center gap-4 bg-background p-2 rounded-xl border border-input">
                                    <label className="text-sm font-bold text-muted-foreground ml-2">Players:</label>
                                    <select 
                                        value={maxPlayers}
                                        onChange={(e) => setMaxPlayers(e.target.value)}
                                        className="flex-1 bg-transparent font-bold outline-none border-none focus:ring-0 text-center"
                                    >
                                        <option value="2">2 Players</option>
                                        <option value="3">3 Players</option>
                                        <option value="4">4 Players</option>
                                        <option value="5">5 Players</option>
                                        <option value="6">6 Players</option>
                                    </select>
                                </div>

                                <button 
                                    onClick={handleCreateGame}
                                    className="w-full mt-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-primary/50"
                                >
                                    CREATE GAME
                                </button>
                            </motion.div>
                        )}

                        {/* Join Game Card */}
                        <motion.div 
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="bg-card/80 backdrop-blur-md border border-border p-8 rounded-3xl shadow-xl flex flex-col items-center text-center space-y-4 hover:border-secondary/50 transition-colors group"
                        >
                            <div className="w-16 h-16 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Users className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Join Room</h2>
                                <p className="text-muted-foreground text-sm mt-1">Enter a 6-character room code to join.</p>
                            </div>
                            
                            <form onSubmit={handleJoinGame} className="w-full mt-4 flex gap-2">
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
                                        <Hash className="w-5 h-5" />
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="ROOM CODE" 
                                        maxLength={6}
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary uppercase font-mono font-bold text-center tracking-widest placeholder:tracking-normal placeholder:font-sans"
                                        required
                                    />
                                </div>
                                <button 
                                    type="submit"
                                    className="px-6 py-3 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/90 transition-all shadow-md hover:shadow-secondary/50 whitespace-nowrap disabled:opacity-50"
                                    disabled={!joinCode.trim()}
                                >
                                    JOIN
                                </button>
                            </form>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Settings Button */}
                <div className="fixed bottom-6 right-6 z-50">
                    <button 
                        onClick={() => { playSfx('click'); setShowSettings(true); }}
                        className="bg-card/80 backdrop-blur-md text-muted-foreground hover:text-foreground transition-colors p-3 rounded-full border border-border shadow-lg hover:shadow-xl"
                    >
                        <Volume2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Settings Modal */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                            onClick={() => setShowSettings(false)}
                        >
                            <div 
                                className="bg-card p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-border relative"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button 
                                    onClick={() => setShowSettings(false)}
                                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <h2 className="text-2xl font-black italic mb-6">VOLUME</h2>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Music Volume</label>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="1" 
                                            step="0.01" 
                                            value={bgmVolume} 
                                            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                                            className="w-full accent-primary cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">SFX Volume</label>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="1" 
                                            step="0.01" 
                                            value={sfxVolume} 
                                            onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                                            className="w-full accent-secondary cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}

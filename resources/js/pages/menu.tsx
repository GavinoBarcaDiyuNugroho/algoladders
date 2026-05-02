import { Head, Link, router } from '@inertiajs/react';
import { motion } from 'motion/react';
import { Plus, Users, Hash, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

export default function Menu() {
    const [joinCode, setJoinCode] = useState('');

    const handleCreateGame = () => {
        router.post('/rooms');
    };

    const handleJoinGame = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinCode.trim()) {
            router.post(`/rooms/join`, { code: joinCode.toUpperCase() });
        }
    };

    return (
        <>
            <Head title="Game Menu - Algo Ladders" />
            <div className="dark relative min-h-screen overflow-hidden bg-background text-foreground flex flex-col items-center justify-center p-6">
                
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
                    <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-semibold bg-card/80 p-3 rounded-full shadow-sm backdrop-blur-md">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="sr-only sm:not-sr-only sm:pr-2">Back</span>
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
                            Create a new room to invite friends, or enter a code to join an existing session.
                        </p>
                    </div>

                    <div className="grid gap-6">
                        {/* Create Game Card */}
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
                            <button 
                                onClick={handleCreateGame}
                                className="w-full mt-4 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-primary/50"
                            >
                                CREATE GAME
                            </button>
                        </motion.div>

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
            </div>
        </>
    );
}

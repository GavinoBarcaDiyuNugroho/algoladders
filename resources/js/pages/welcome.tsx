import { Head, Link, usePage, router } from '@inertiajs/react';
import { dashboard, login } from '@/routes';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Play, BookOpen, X } from 'lucide-react';
import { useState } from 'react';

export default function Welcome() {
    const { auth } = usePage().props as any;
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGuestLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (guestName.trim()) {
            setLoading(true);
            router.post('/guest-login', { name: guestName }, {
                onFinish: () => setLoading(false)
            });
        }
    };

    return (
        <>
            <Head title="Welcome to Algo Ladders" />
            <div className="relative min-h-screen overflow-hidden bg-background text-foreground flex flex-col items-center justify-center p-6">
                
                {/* Animated Background Loop */}
                <div className="absolute inset-0 z-0 overflow-hidden opacity-30 pointer-events-none flex justify-center">
                    {/* Simulated Wooden Ladders moving upwards */}
                    <motion.div 
                        initial={{ y: "100%" }}
                        animate={{ y: "-100%" }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        className="w-32 h-[200vh] border-x-8 border-amber-800 flex flex-col justify-around absolute left-[15%]"
                    >
                        {Array.from({length: 12}).map((_, i) => (
                            <div key={i} className="w-full h-4 bg-amber-800" />
                        ))}
                    </motion.div>
                    
                    <motion.div 
                        initial={{ y: "100%" }}
                        animate={{ y: "-100%" }}
                        transition={{ duration: 18, repeat: Infinity, ease: "linear", delay: 2 }}
                        className="w-40 h-[200vh] border-x-8 border-amber-900 flex flex-col justify-around absolute right-[10%]"
                    >
                        {Array.from({length: 8}).map((_, i) => (
                            <div key={i} className="w-full h-4 bg-amber-900" />
                        ))}
                    </motion.div>
                    
                    {/* Floating Code Snippets */}
                    <motion.div 
                        animate={{ y: ["0%", "-30%", "0%"], opacity: [0.3, 0.7, 0.3] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-[20%] left-[30%] text-primary/60 font-mono text-2xl font-bold"
                    >
                        {'if (pos == snake) slide();'}
                    </motion.div>
                    
                    <motion.div 
                        animate={{ y: ["0%", "20%", "0%"], opacity: [0.2, 0.6, 0.2] }}
                        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        className="absolute bottom-[30%] right-[35%] text-secondary/60 font-mono text-xl font-bold"
                    >
                        {'for(let i=0; i<roll; i++)'}
                    </motion.div>

                    <motion.div 
                        animate={{ x: ["0%", "10%", "0%"], opacity: [0.1, 0.5, 0.1] }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                        className="absolute top-[60%] left-[10%] text-emerald-500/50 font-mono text-xl font-bold"
                    >
                        {'while(player.pos < 100)'}
                    </motion.div>

                    <motion.div 
                        animate={{ x: ["0%", "-15%", "0%"], opacity: [0.2, 0.8, 0.2] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 3 }}
                        className="absolute top-[10%] right-[20%] text-indigo-500/50 font-mono text-3xl font-bold"
                    >
                        {'function rollDice()'}
                    </motion.div>
                </div>

                {/* Main Content */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 max-w-2xl w-full text-center space-y-8 p-8 rounded-3xl bg-card/80 backdrop-blur-md shadow-2xl border border-border"
                >
                    <div className="space-y-4">
                        <motion.h1 
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-5xl md:text-7xl font-black italic tracking-tighter"
                        >
                            ALGO<span className="text-primary">LADDERS</span>
                        </motion.h1>
                        <p className="text-muted-foreground text-lg md:text-xl font-medium">
                            An advanced multiplayer coding twist on the classic game.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                        {auth.user ? (
                            <Link
                                href="/menu"
                                className="group flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/50"
                            >
                                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                PLAY NOW
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="group flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/50"
                                >
                                    <LogIn className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                    LOGIN
                                </Link>
                                <button
                                    onClick={() => setShowGuestModal(true)}
                                    className="group flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/90 transition-all shadow-lg hover:shadow-secondary/50"
                                >
                                    <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    START (GUEST)
                                </button>
                            </>
                        )}
                        
                        <Link 
                            href="/guide"
                            className="group flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-card text-card-foreground border-2 border-border font-bold rounded-xl hover:bg-muted transition-all shadow-sm"
                        >
                            <BookOpen className="w-5 h-5 group-hover:text-primary transition-colors" />
                            HOW TO PLAY
                        </Link>
                    </div>
                </motion.div>

                {/* Footer */}
                <div className="absolute bottom-6 text-sm text-muted-foreground font-medium z-10">
                    &copy; {new Date().getFullYear()} Algo Ladders. All rights reserved.
                </div>
                
                {/* Guest Login Modal */}
                <AnimatePresence>
                    {showGuestModal && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        >
                            <motion.div 
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="bg-card p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-border relative"
                            >
                                <button 
                                    onClick={() => setShowGuestModal(false)}
                                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <h2 className="text-2xl font-black italic mb-2">JOIN AS GUEST</h2>
                                <p className="text-muted-foreground text-sm mb-6">Enter a display name to jump right into the action.</p>
                                
                                <form onSubmit={handleGuestLogin} className="flex flex-col gap-4">
                                    <input 
                                        type="text" 
                                        placeholder="Display Name" 
                                        value={guestName}
                                        onChange={e => setGuestName(e.target.value)}
                                        maxLength={15}
                                        className="bg-background border border-input p-3 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none font-bold text-center"
                                        required
                                        autoFocus
                                    />
                                    <button 
                                        type="submit"
                                        disabled={loading || !guestName.trim()}
                                        className="w-full bg-secondary text-secondary-foreground font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-secondary/90 transition-all shadow-md"
                                    >
                                        {loading ? 'JOINING...' : 'PLAY NOW'}
                                    </button>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}

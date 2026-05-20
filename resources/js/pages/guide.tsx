import { Head, Link } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Dice5, Zap, ShieldAlert, Users, Trophy } from 'lucide-react';
import { useState } from 'react';

const sections = [
    {
        id: 'basics',
        title: 'The Basics',
        icon: <Dice5 className="w-6 h-6" />,
        content: `Algo Ladders is a turn-based multiplayer game where players race to tile 100. Instead of just rolling dice, players use programming concepts to navigate the board. Roll the dice to move, but use your logic to avoid traps and maximize your turns.`
    },
    {
        id: 'powers',
        title: 'Coding Powers',
        icon: <Zap className="w-6 h-6" />,
        content: `You have three unique programming powers each turn:
        • MATH (+, -, *, /): Alter the dice roll with mathematical operators based on the tile value.
        • FOR LOOP: Loop your movement multiple times. Great for covering large distances!
        • IF-ELSE: Build conditional logic to protect yourself from snakes and traps, or trigger special actions.`
    },
    {
        id: 'hazards',
        title: 'Hazards & Board',
        icon: <ShieldAlert className="w-6 h-6" />,
        content: `Watch out for Snakes that send you backwards, and Traps that trigger negative effects like losing HP or losing a turn. Use Ladders to skip ahead. If your HP reaches 0, you are eliminated!`
    },
    {
        id: 'multiplayer',
        title: 'Multiplayer Strategy',
        icon: <Users className="w-6 h-6" />,
        content: `Pay attention to the turn order! Use IF-ELSE to set traps for other players or defend yourself when it's not your turn. Timing your FOR LOOPs when there are no hazards ahead is key.`
    },
    {
        id: 'winning',
        title: 'Winning the Game',
        icon: <Trophy className="w-6 h-6" />,
        content: `The first player to reach exactly tile 100 wins! If you roll a number that takes you past 100, you will bounce backwards. Alternatively, be the last player standing if everyone else loses their HP.`
    }
];

export default function Guide() {
    const [activeSection, setActiveSection] = useState(sections[0].id);

    return (
        <>
            <Head title="How to Play - Algo Ladders" />
            <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-semibold bg-card/80 p-3 rounded-full shadow-sm border border-border backdrop-blur-md">
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Title</span>
                        </Link>
                    </div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden"
                    >
                        <div className="bg-primary p-8 text-primary-foreground">
                            <h1 className="text-4xl md:text-5xl font-black italic tracking-tight">HOW TO PLAY</h1>
                            <p className="mt-2 text-lg font-medium opacity-90">Master the logic, conquer the board.</p>
                        </div>
                        
                        <div className="flex flex-col md:flex-row">
                            {/* Sidebar Menu */}
                            <div className="md:w-1/3 bg-muted/30 border-r border-border p-6 flex flex-col gap-2">
                                {sections.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setActiveSection(s.id)}
                                        className={`flex items-center gap-3 w-full text-left p-4 rounded-xl font-bold transition-all ${
                                            activeSection === s.id 
                                            ? 'bg-primary text-primary-foreground shadow-md scale-105' 
                                            : 'text-muted-foreground hover:bg-card hover:text-foreground'
                                        }`}
                                    >
                                        {s.icon}
                                        {s.title}
                                    </button>
                                ))}
                            </div>

                            {/* Content Area */}
                            <div className="md:w-2/3 p-8 md:p-12 min-h-[400px] relative">
                                <AnimatePresence mode="wait">
                                    {sections.map(s => s.id === activeSection && (
                                        <motion.div
                                            key={s.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3 }}
                                            className="absolute inset-0 p-8 md:p-12 flex flex-col justify-center"
                                        >
                                            <div className="flex items-center gap-4 mb-6 text-primary">
                                                <div className="p-3 bg-primary/10 rounded-2xl">
                                                    {s.icon}
                                                </div>
                                                <h2 className="text-3xl font-black">{s.title}</h2>
                                            </div>
                                            <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line font-medium">
                                                {s.content}
                                            </p>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </>
    );
}

import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { echo } from '@laravel/echo-react';

interface Player {
    id: number;
    user_id: number;
    pos: number;
    hp: number;
    alive: boolean;
    color: string;
    user?: {
        name: string;
    };
}

interface GameState {
    currentPlayerIndex: number;
    tileValues: number[];
    tileTerrains: string[];
    players: Player[];
    snakes: Record<number, number>;
    ladders: Record<number, number>;
    log: string[];
}

interface Room {
    id: number;
    code: string;
    owner_id: number;
    max_players: number;
    game_state: GameState;
    players: any[];
}

export default function Game({ room, currentUser, isOwner }: { room: Room, currentUser: any, isOwner: boolean }) {
    const [gameState, setGameState] = useState<GameState>(room.game_state);

    useEffect(() => {
        const channel = echo().join(`room.${room.code}`);
        
        channel.listen('GameStateUpdated', (e: any) => {
            setGameState(e.gameState);
        });

        return () => {
            echo().leave(`room.${room.code}`);
        };
    }, [room.code]);

    // Build the 10x10 zigzag grid (from tile 100 down to 1)
    const renderBoard = () => {
        const tiles = [];
        for (let r = 9; r >= 0; r--) {
            const isEven = r % 2 !== 0; // Row 9 is 91-100 (right to left), Row 8 is 81-90 (left to right)
            for (let c = 0; c < 10; c++) {
                const col = isEven ? (9 - c) : c;
                const val = r * 10 + col + 1;
                
                const terrain = gameState.tileTerrains[val] || 'grass';
                const tileValue = gameState.tileValues[val] || 0;

                tiles.push(
                    <div 
                        key={val} 
                        id={`tile-${val}`}
                        className={`isometric-tile terrain-${terrain} w-full aspect-square flex flex-col items-center justify-center rounded-sm relative`}
                    >
                        <span className="text-[10px] md:text-xs font-bold text-black/50 absolute top-1 left-1">{val}</span>
                        <span className="text-sm md:text-xl font-black text-black/70">{tileValue}</span>
                        
                        {/* Tokens on this tile */}
                        {gameState.players.filter(p => p.pos === val && p.alive).map((p, idx) => (
                            <motion.div
                                key={p.id}
                                layoutId={`token-${p.id}`}
                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                className="isometric-token absolute w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold z-20"
                                style={{ 
                                    backgroundColor: p.color,
                                    // Slight offset if multiple players are on the same tile
                                    marginLeft: `${idx * 8}px`,
                                    marginTop: `${idx * 8}px`
                                }}
                            >
                                {p.id}
                            </motion.div>
                        ))}
                    </div>
                );
            }
        }
        return tiles;
    };

    const renderSnakesAndLadders = () => {
        const lines: React.ReactNode[] = [];
        
        // Draw Snakes (Red/Purple curves)
        Object.entries(gameState.snakes).forEach(([head, tail], i) => {
            const h = parseInt(head);
            const t = tail;
            // Get coordinates (roughly) - in a real app we'd use Refs, but here we can estimate based on grid percentages
            // 10x10 grid. Each tile is 10% width/height.
            const getCoords = (val: number) => {
                const r = Math.floor((val - 1) / 10); // 0 to 9 (bottom to top)
                const c = r % 2 === 0 ? (val - 1) % 10 : 9 - ((val - 1) % 10);
                // In DOM, row 0 is top. So we invert r.
                const top = (9 - r) * 10 + 5;
                const left = c * 10 + 5;
                return { top, left };
            };
            const p1 = getCoords(h);
            const p2 = getCoords(t);
            
            lines.push(
                <path 
                    key={`snake-${i}`}
                    d={`M ${p1.left}% ${p1.top}% Q ${(p1.left + p2.left)/2 + 10}% ${(p1.top + p2.top)/2} ${p2.left}% ${p2.top}%`}
                    fill="none"
                    stroke="#db2777" // Pink/red for snake
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="opacity-70 drop-shadow-md"
                />
            );
            // Snake head marker
            lines.push(
                <circle key={`snake-head-${i}`} cx={`${p1.left}%`} cy={`${p1.top}%`} r="2" fill="#9d174d" />
            );
        });

        // Draw Ladders (Blue/Cyan straight lines with rungs)
        Object.entries(gameState.ladders).forEach(([bottom, top], i) => {
            const b = parseInt(bottom);
            const t = top;
            const getCoords = (val: number) => {
                const r = Math.floor((val - 1) / 10);
                const c = r % 2 === 0 ? (val - 1) % 10 : 9 - ((val - 1) % 10);
                const top = (9 - r) * 10 + 5;
                const left = c * 10 + 5;
                return { top, left };
            };
            const p1 = getCoords(b);
            const p2 = getCoords(t);
            
            lines.push(
                <line 
                    key={`ladder-${i}`}
                    x1={`${p1.left}%`} y1={`${p1.top}%`} 
                    x2={`${p2.left}%`} y2={`${p2.top}%`} 
                    stroke="#0ea5e9" // Sky blue
                    strokeWidth="6"
                    strokeDasharray="2 4"
                    strokeLinecap="square"
                    className="opacity-70 drop-shadow-md"
                />
            );
            // Ladder solid rails
            lines.push(
                <line 
                    key={`ladder-r1-${i}`}
                    x1={`calc(${p1.left}% - 3px)`} y1={`${p1.top}%`} 
                    x2={`calc(${p2.left}% - 3px)`} y2={`${p2.top}%`} 
                    stroke="#0369a1" strokeWidth="2" className="opacity-80"
                />
            );
            lines.push(
                <line 
                    key={`ladder-r2-${i}`}
                    x1={`calc(${p1.left}% + 3px)`} y1={`${p1.top}%`} 
                    x2={`calc(${p2.left}% + 3px)`} y2={`${p2.top}%`} 
                    stroke="#0369a1" strokeWidth="2" className="opacity-80"
                />
            );
        });

        return lines;
    };

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isMyTurn = currentPlayer?.user_id === currentUser.id;

    return (
        <>
            <Head title={`Game ${room.code} - Algo Ladders`} />
            <div className="min-h-screen bg-slate-900 text-foreground p-4 md:p-8 flex flex-col lg:flex-row gap-8 overflow-hidden">
                
                {/* Left Panel: Players & Log */}
                <div className="w-full lg:w-72 flex flex-col gap-4 z-10">
                    <div className="bg-slate-800/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-black italic tracking-tight text-white mb-4">PLAYERS</h2>
                        <div className="space-y-3">
                            {gameState.players.map((p, i) => (
                                <div 
                                    key={p.id} 
                                    className={`p-3 rounded-xl border-l-4 transition-all ${!p.alive ? 'opacity-40 grayscale' : ''} ${i === gameState.currentPlayerIndex ? 'bg-slate-700 scale-105 shadow-lg' : 'bg-slate-800/50'}`}
                                    style={{ borderColor: p.color }}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-sm text-white">Player {p.id} {p.user_id === currentUser.id && '(You)'}</span>
                                        <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded text-slate-300">Pos: {p.pos}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <span key={idx} className="text-sm">
                                                {idx < p.hp ? '❤️' : '🖤'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Console Log */}
                    <div className="bg-slate-800/80 backdrop-blur-md flex-1 min-h-[200px] rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-xl">
                        <div className="bg-slate-900/80 px-4 py-2 text-xs font-bold text-slate-400 tracking-wider">CONSOLE</div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-2 font-mono text-xs">
                            {gameState.log.slice().reverse().map((msg, i) => (
                                <div key={i} className="text-slate-300 border-b border-slate-700/50 pb-1">
                                    <span className="text-blue-400 mr-2">❯</span>{msg}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center Panel: The Board */}
                <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] perspective-container z-0 relative">
                    <div className="w-full max-w-2xl perspective-board grid grid-cols-10 gap-1 p-2 bg-slate-800 rounded-xl relative">
                        {renderBoard()}
                        
                        {/* SVG Overlay for Snakes and Ladders */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                            {renderSnakesAndLadders()}
                        </svg>
                    </div>
                </div>

                {/* Right Panel: Controls */}
                <div className="w-full lg:w-80 flex flex-col gap-4 z-10">
                    <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Current Turn</p>
                        <h2 className="text-2xl font-black text-white mb-6" style={{ color: currentPlayer?.color }}>
                            PLAYER {currentPlayer?.id}
                        </h2>

                        {isMyTurn ? (
                            <div className="w-full space-y-4">
                                <p className="text-sm text-center text-slate-300 mb-2">It's your turn! Choose an action:</p>
                                
                                <div className="grid grid-cols-3 gap-2">
                                    <button className="bg-slate-700 hover:bg-blue-600 p-3 rounded-xl flex flex-col items-center transition-colors group">
                                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">➕</span>
                                        <span className="text-[10px] font-bold text-white">MATH</span>
                                    </button>
                                    <button className="bg-slate-700 hover:bg-emerald-600 p-3 rounded-xl flex flex-col items-center transition-colors group">
                                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🌿</span>
                                        <span className="text-[10px] font-bold text-white">IF-ELSE</span>
                                    </button>
                                    <button className="bg-slate-700 hover:bg-amber-600 p-3 rounded-xl flex flex-col items-center transition-colors group">
                                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🔁</span>
                                        <span className="text-[10px] font-bold text-white">FOR</span>
                                    </button>
                                </div>
                                
                                <button className="w-full mt-4 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white tracking-widest shadow-lg shadow-indigo-900/50 transition-all active:scale-95">
                                    ROLL DICE
                                </button>
                            </div>
                        ) : (
                            <div className="w-full text-center p-6 border-2 border-dashed border-slate-600 rounded-xl bg-slate-800/50">
                                <p className="text-slate-400 animate-pulse">Waiting for Player {currentPlayer?.id} to move...</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </>
    );
}

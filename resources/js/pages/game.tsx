import { Head } from '@inertiajs/react';
import { useState, useEffect, useMemo, useRef } from 'react';
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

// Simple Seeded Random Number Generator to ensure all players see the exact same organic board
function createSeededRandom(seed: number) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export default function Game({ room, currentUser, isOwner }: { room: Room, currentUser: any, isOwner: boolean }) {
    const [gameState, setGameState] = useState<GameState>(room.game_state);
    
    // Map Panning State
    const [pan, setPan] = useState({ x: 0, y: -500 });
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const channel = echo().join(`room.${room.code}`);
        
        channel.listen('GameStateUpdated', (e: any) => {
            setGameState(e.gameState);
        });

        channel.listen('RoomClosed', () => {
            alert('The game room has been closed.');
            import('@inertiajs/react').then(({ router }) => router.visit('/menu'));
        });

        return () => {
            echo().leave(`room.${room.code}`);
        };
    }, [room.code]);

    // Handle Drag to Pan Map
    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    // Algorithmically generate sparse, sweeping looping 100-tile path using DFS Maze Walk
    const tileCoordinates = useMemo(() => {
        const coords: Record<number, { x: number, y: number }> = {};
        const random = createSeededRandom(room.id * 12345);
        
        const path: {x: number, y: number}[] = [{ x: 5, y: 0 }];
        const grid = new Set(['5,0']);
        let iterations = 0;

        const dfs = (enforceThin: boolean, currentDir: {dx: number, dy: number} | null, segmentLen: number): boolean => {
            iterations++;
            if (iterations > 150000) return false; // Prevent infinite loop freeze
            
            if (path.length === 100) return true;

            const curr = path[path.length - 1];
            let moves = [];

            // If we have a direction and haven't reached min length (3), we MUST keep going straight!
            if (currentDir && segmentLen < 3) {
                moves = [currentDir];
            } else {
                // Otherwise, we can go straight, turn left, or turn right. (No 180 degree U-turns allowed)
                const allMoves = [ {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1} ];
                for (const m of allMoves) {
                    // Prevent 180 U-turn
                    if (currentDir && m.dx === -currentDir.dx && m.dy === -currentDir.dy) continue;
                    moves.push(m);
                }
                // Shuffle available moves
                for (let i = moves.length - 1; i > 0; i--) {
                    const j = Math.floor(random() * (i + 1));
                    [moves[i], moves[j]] = [moves[j], moves[i]];
                }
            }

            for (const m of moves) {
                const nx = curr.x + m.dx;
                const ny = curr.y + m.dy;
                const key = `${nx},${ny}`;
                
                // Keep the maze large enough for sweeping curves (16 columns, 24 rows)
                if (nx >= 0 && nx <= 15 && ny >= 0 && ny <= 24) {
                    if (!grid.has(key)) {
                        
                        let valid = true;
                        if (enforceThin) {
                            // "Thin" path: should not touch any other existing tile except its immediate predecessor
                            let touching = 0;
                            const neighbors = [ `${nx+1},${ny}`, `${nx-1},${ny}`, `${nx},${ny+1}`, `${nx},${ny-1}` ];
                            for (const n of neighbors) {
                                if (grid.has(n)) touching++;
                            }
                            if (touching > 1) valid = false;
                        }

                        if (valid) {
                            grid.add(key);
                            path.push({x: nx, y: ny});
                            
                            const isSameDir = currentDir && currentDir.dx === m.dx && currentDir.dy === m.dy;
                            const nextLen = isSameDir ? segmentLen + 1 : 1;
                            
                            if (dfs(enforceThin, m, nextLen)) return true;
                            
                            path.pop();
                            grid.delete(key);
                        }
                    }
                }
            }
            return false;
        };

        // Try to generate a sweeping "thin" maze loop. If it takes too long, fall back.
        let success = dfs(true, {dx: 0, dy: 1}, 1);
        if (!success) {
            iterations = 0;
            path.length = 1;
            grid.clear(); grid.add('5,0');
            success = dfs(false, {dx: 0, dy: 1}, 1);
        }
        
        // If all algorithmic walks fail, fallback to a safe organic S-curve
        if (success) {
            path.forEach((p, i) => {
                coords[i + 1] = { x: 100 + p.x * 80, y: 100 + p.y * 80 };
            });
        } else {
            console.error("Path DFS fallback used");
            let cx = 0, cy = 0, dir = 1;
            for (let i = 1; i <= 100; i++) {
                coords[i] = { x: 100 + cx * 80, y: 100 + cy * 80 };
                if ((dir === 1 && cx >= 9) || (dir === -1 && cx <= 0)) {
                    cy++; dir *= -1;
                } else {
                    cx += dir;
                }
            }
        }
        
        return coords;
    }, [room.id]);

    // Auto-pan to current player when turn changes
    useEffect(() => {
        if (!gameState || !gameState.players) return;
        const cp = gameState.players[gameState.currentPlayerIndex];
        if (cp && tileCoordinates && tileCoordinates[cp.pos]) {
            const coord = tileCoordinates[cp.pos];
            // Center roughly on the player's current tile
            setPan({
                x: -coord.x + 400,
                y: -coord.y + 100
            });
        }
    }, [gameState.currentPlayerIndex, tileCoordinates]);

    const renderBoard = () => {
        const tiles = [];
        for (let val = 1; val <= 100; val++) {
            const terrain = gameState.tileTerrains[val] || 'grass';
            const coord = tileCoordinates[val];
            if (!coord) continue;

            tiles.push(
                <div 
                    key={val} 
                    id={`slab-${val}`}
                    className={`slab terrain-${terrain}`}
                    style={{ left: `${coord.x}px`, top: `${coord.y}px` }}
                >
                    <div className="slab-side"></div>
                    <div className={`slab-top terrain-${terrain} flex flex-col items-center justify-center p-1`}>
                        <span className="font-black text-white/90 drop-shadow-md text-sm leading-tight">
                            {val === 1 ? 'START' : val === 100 ? 'FINISH' : val}
                        </span>
                        {val !== 1 && val !== 100 && (
                            <span className="text-[9px] font-bold text-white/70">
                                val: {gameState.tileValues?.[val] || 0}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
        return tiles;
    };

    const renderAvatars = () => {
        return gameState.players.filter(p => p.alive).map((p, idx) => {
            const coord = tileCoordinates[p.pos];
            if (!coord) return null;
            
            const name = p.name || `Player ${p.id}`;
            const initials = name.substring(0, 2).toUpperCase();

            return (
                <motion.div
                    key={p.id}
                    layoutId={`avatar-${p.id}`}
                    initial={false}
                    animate={{
                        left: `${coord.x + 13 + (idx * 5)}px`, 
                        top: `${coord.y + 5 + (idx * 5)}px`,
                        z: 60
                    }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="absolute"
                    style={{ zIndex: 600 + idx, transformStyle: 'preserve-3d' }}
                >
                    <div 
                        className="avatar-bubble"
                        style={{ transform: 'rotateZ(30deg) rotateX(-50deg)' }}
                    >
                        <div className="text-[9px] font-bold text-slate-800 mb-1 leading-none absolute -top-4 w-max px-1 bg-white/90 rounded border border-slate-200">
                            {name.substring(0, 8)}
                        </div>
                        <div className="avatar-img shadow-lg" style={{ backgroundColor: p.color, color: 'white' }}>
                            {initials}
                        </div>
                    </div>
                </motion.div>
            );
        });
    };

    const renderSnakesAndLadders = () => {
        const lines: React.ReactNode[] = [];
        
        Object.entries(gameState.snakes).forEach(([head, tail], i) => {
            const h = parseInt(head);
            const t = tail;
            
            const p1 = tileCoordinates[h];
            const p2 = tileCoordinates[t];
            if (!p1 || !p2) return;
            
            const startX = p1.x + 35;
            const startY = p1.y + 35;
            const endX = p2.x + 35;
            const endY = p2.y + 35;

            const angle = Math.atan2(endY - startY, endX - startX);
            const segments = 4;
            const amplitude = 35;

            let d = `M ${startX} ${startY}`;
            for (let j = 1; j <= segments; j++) {
                const t_val = j / segments;
                const px = startX + (endX - startX) * t_val;
                const py = startY + (endY - startY) * t_val;

                const nx = Math.cos(angle + Math.PI / 2);
                const ny = Math.sin(angle + Math.PI / 2);

                const waveOffset = (j % 2 === 0 ? 1 : -1) * amplitude;
                const midX = startX + (endX - startX) * (t_val - 0.125) + nx * waveOffset;
                const midY = startY + (endY - startY) * (t_val - 0.125) + ny * waveOffset;

                d += ` Q ${midX} ${midY} ${px} ${py}`;
            }

            lines.push(
                <g key={`snake-${i}`}>
                    <path d={d} fill="none" stroke="#2c5521" strokeWidth="22" strokeLinecap="round" className="drop-shadow-lg" />
                    <path d={d} fill="none" stroke="#b0c929" strokeWidth="6" strokeDasharray="10 10" strokeLinecap="round" />
                    <ellipse cx={startX} cy={startY} rx="16" ry="13" fill="#2c5521" transform={`rotate(${angle * 180 / Math.PI + 180}, ${startX}, ${startY})`} />
                    <circle cx={startX - 6} cy={startY - 4} r="3" fill="white" transform={`rotate(${angle * 180 / Math.PI + 180}, ${startX}, ${startY})`} />
                    <circle cx={startX + 6} cy={startY - 4} r="3" fill="white" transform={`rotate(${angle * 180 / Math.PI + 180}, ${startX}, ${startY})`} />
                    <circle cx={startX - 6} cy={startY - 4} r="1" fill="black" transform={`rotate(${angle * 180 / Math.PI + 180}, ${startX}, ${startY})`} />
                    <circle cx={startX + 6} cy={startY - 4} r="1" fill="black" transform={`rotate(${angle * 180 / Math.PI + 180}, ${startX}, ${startY})`} />
                </g>
            );
        });

        Object.entries(gameState.ladders).forEach(([bottom, top], i) => {
            const b = parseInt(bottom);
            const t = top;
            
            const p1 = tileCoordinates[b];
            const p2 = tileCoordinates[t];
            if (!p1 || !p2) return;

            const x1 = p1.x + 35;
            const y1 = p1.y + 35;
            const x2 = p2.x + 35;
            const y2 = p2.y + 35;

            const angle = Math.atan2(y2 - y1, x2 - x1);
            const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            
            const railOffset = 16;
            const ox = Math.cos(angle + Math.PI / 2) * railOffset;
            const oy = Math.sin(angle + Math.PI / 2) * railOffset;

            lines.push(
                <g key={`ladder-${i}`} className="drop-shadow-lg">
                    <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} stroke="#8b5a2b" strokeWidth="7" strokeLinecap="round" />
                    <line x1={x1 - ox} y1={y1 - oy} x2={x2 - ox} y2={y2 - oy} stroke="#8b5a2b" strokeWidth="7" strokeLinecap="round" />
                </g>
            );

            const steps = Math.floor(dist / 22);
            for (let j = 1; j < steps; j++) {
                const tv = j / steps;
                const rx = x1 + (x2 - x1) * tv;
                const ry = y1 + (y2 - y1) * tv;
                lines.push(
                    <line key={`ladder-rung-${i}-${j}`} x1={rx + ox} y1={ry + oy} x2={rx - ox} y2={ry - oy} stroke="#a67c52" strokeWidth="5" />
                );
            }
        });

        return lines;
    };

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isMyTurn = currentPlayer?.user_id === currentUser.id;

    return (
        <>
            <Head title={`Game ${room.code} - Algo Ladders`} />
            <div 
                className="game-viewport bg-gradient-to-br from-sky-200 via-green-100 to-emerald-200" 
            >
                
                {/* Left Panel: Players & Log Overlay */}
                <div className="absolute left-4 top-4 bottom-4 w-72 flex flex-col gap-4 z-50 pointer-events-none">
                    <div className="bg-[#2b2926]/90 backdrop-blur-md p-5 rounded-2xl border border-[#45423d] shadow-2xl pointer-events-auto">
                        <h2 className="text-xl font-black italic tracking-tight text-white mb-4">PLAYERS</h2>
                        <div className="space-y-3">
                            {gameState.players.map((p, i) => (
                                <div 
                                    key={p.id} 
                                    className={`p-3 rounded-xl border-l-4 transition-all ${!p.alive ? 'opacity-40 grayscale' : ''} ${i === gameState.currentPlayerIndex ? 'bg-[#3d3a36] scale-105 shadow-md' : 'bg-[#1e1c1a]'}`}
                                    style={{ borderColor: p.color }}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-sm text-white truncate max-w-[120px]">{p.name || `Player ${p.id}`} {p.user_id === currentUser.id && '(You)'}</span>
                                        <span className="text-xs font-mono bg-black/40 px-2 py-0.5 rounded text-gray-300 ml-2">Pos: {p.pos}</span>
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

                    <div className="bg-[#2b2926]/90 backdrop-blur-md flex-1 min-h-[200px] rounded-2xl border border-[#45423d] flex flex-col overflow-hidden shadow-2xl pointer-events-auto">
                        <div className="bg-[#1e1c1a]/80 px-4 py-2 text-xs font-bold text-gray-400 tracking-wider">CONSOLE</div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-2 font-mono text-xs text-white">
                            {gameState.log.slice().reverse().map((msg, i) => (
                                <div key={i} className="border-b border-[#45423d]/50 pb-1">
                                    <span className="text-[#81b64c] mr-2">❯</span>{msg}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Map Container - Now Draggable! */}
                <div 
                    className="w-full h-full flex items-center justify-center z-10"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    style={{ cursor: 'grab', touchAction: 'none' }}
                >
                    <div 
                        className="map-container" 
                        style={{ 
                            transform: `translate(${pan.x}px, ${pan.y}px) rotateX(50deg) rotateZ(-30deg)`,
                            transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
                        }}
                    >
                        {renderBoard()}
                        
                        {/* SVGs (Snakes/Ladders) drawn at 25px height (translateZ) */}
                        <svg className="absolute inset-0 w-[2000px] h-[3000px] pointer-events-none" style={{ transform: 'translateZ(25px)', overflow: 'visible' }}>
                            {renderSnakesAndLadders()}
                        </svg>

                        {renderAvatars()}
                    </div>
                </div>

                {/* Bottom Panel: Actions (from prototype UI panel) */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                    <div className="bg-[#2b2926] p-6 rounded-3xl border border-[#45423d] shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col items-center">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">
                            Current Turn: <span style={{ color: currentPlayer?.color }}>{currentPlayer?.name}</span>
                        </div>
                        
                        {isMyTurn ? (
                            <div className="w-full flex flex-col items-center gap-4 mt-2">
                                <div className="flex gap-2">
                                    <button className="bg-[#3d3a36] hover:bg-[#81b64c] p-3 rounded-xl flex flex-col items-center transition-colors border border-[#45423d]">
                                        <span className="text-xl mb-1">➕</span>
                                        <span className="text-[10px] font-bold text-white">MATH</span>
                                    </button>
                                    <button className="bg-[#3d3a36] hover:bg-[#81b64c] p-3 rounded-xl flex flex-col items-center transition-colors border border-[#45423d]">
                                        <span className="text-xl mb-1">🌿</span>
                                        <span className="text-[10px] font-bold text-white">IF-ELSE</span>
                                    </button>
                                    <button className="bg-[#3d3a36] hover:bg-[#81b64c] p-3 rounded-xl flex flex-col items-center transition-colors border border-[#45423d]">
                                        <span className="text-xl mb-1">🔁</span>
                                        <span className="text-[10px] font-bold text-white">FOR</span>
                                    </button>
                                </div>
                                <button className="bg-[#81b64c] text-white px-12 py-4 font-black text-xl rounded-xl shadow-[0_5px_0_#4a672d] active:shadow-[0_2px_0_#4a672d] active:translate-y-[3px] transition-all tracking-widest mt-2 w-full">
                                    ROLL DICE
                                </button>
                            </div>
                        ) : (
                            <div className="w-full text-center mt-6">
                                <p className="text-gray-400 animate-pulse font-bold text-sm tracking-widest">WAITING...</p>
                            </div>
                        )}
                        
                        <button 
                            onClick={() => {
                                if (confirm('Are you sure you want to surrender and leave the game?')) {
                                    import('@inertiajs/react').then(({ router }) => router.post(`/rooms/${room.code}/leave`));
                                }
                            }}
                            className="text-[#ef4444] hover:text-[#f87171] font-bold text-xs flex items-center gap-2 mt-6 transition-colors"
                        >
                            <span>🏳️</span> SURRENDER
                        </button>
                    </div>
                </div>

            </div>
        </>
    );
}

import { Head, router } from '@inertiajs/react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { echo } from '@laravel/echo-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X } from 'lucide-react';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { useSoundEffects } from '../hooks/useSoundEffects';
import GameToast, { ToastData, ToastType } from '../components/GameToast';

interface Player {
    id: number;
    user_id: number;
    name?: string;
    pos: number;
    hp: number;
    alive: boolean;
    color: string;
    activeEffect?: any;
    finished?: boolean;
    place?: number;
    user?: { name: string };
}

interface IfElseOption { id: string; text: string; }

interface GameState {
    currentPlayerIndex: number;
    tileValues: number[];
    tileTerrains: string[];
    players: Player[];
    snakes: Record<number, number>;
    ladders: Record<number, number>;
    log: string[];
    phase: 'select' | 'roll' | 'action';
    selectedPower: 'math' | 'ifelse' | 'forloop' | null;
    lastRoll: number | null;
    ifelseOptions: {
        conditions: IfElseOption[];
        positive: IfElseOption[];
        negative: IfElseOption[];
        neutral: IfElseOption[];
    } | null;
    status: 'playing' | 'finished';
    winner: string | null;
    rankings: { name: string; place: number }[];
}

interface Room {
    id: number;
    code: string;
    owner_id: number;
    max_players: number;
    game_state: GameState;
    players: any[];
    timer_ends_at?: string;
}

type TileCoordinates = Record<number, { x: number, y: number }>;

// Simple Seeded Random Number Generator to ensure all players see the exact same organic board
function createSeededRandom(seed: number) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
// DiceFace — renders dice dots in the correct pattern for a given value (1-6)
function DiceFace({ value, size = 80 }: { value: number, size?: number }) {
    const dotSize = size * 0.16;
    const pad = size * 0.22;
    const mid = size / 2;

    // Positions: top-left, top-right, middle-left, center, middle-right, bottom-left, bottom-right
    const positions: Record<number, [number, number][]> = {
        1: [[mid, mid]],
        2: [[size - pad, pad], [pad, size - pad]],
        3: [[size - pad, pad], [mid, mid], [pad, size - pad]],
        4: [[pad, pad], [size - pad, pad], [pad, size - pad], [size - pad, size - pad]],
        5: [[pad, pad], [size - pad, pad], [mid, mid], [pad, size - pad], [size - pad, size - pad]],
        6: [[pad, pad], [pad, mid], [pad, size - pad], [size - pad, pad], [size - pad, mid], [size - pad, size - pad]],
    };

    const dots = positions[value] || positions[1];

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {dots.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={dotSize} fill="#1e293b" />
            ))}
        </svg>
    );
}

function PlayerAvatar({ p, idx, tileCoordinates, onHopSfx, onHopStep }: { p: Player, idx: number, tileCoordinates: TileCoordinates, onHopSfx: () => void, onHopStep?: (tilePos: number) => void }) {
    const [pathCoords, setPathCoords] = useState<{left: number, top: number}[]>([]);
    const prevPosRef = useRef(p.pos);
    const hopSpeedRef = useRef(200);

    useEffect(() => {
        const oldPos = prevPosRef.current;
        const newPos = p.pos;
        const newPath: {left: number, top: number}[] = [];
        const tilePath: number[] = []; // track tile positions for camera follow

        if (oldPos !== newPos && Math.abs(newPos - oldPos) <= 25) {
            const step = newPos > oldPos ? 1 : -1;
            for (let i = oldPos; i !== newPos + step; i += step) {
                const c = tileCoordinates[i];
                if (c) {
                    newPath.push({ left: c.x + 13 + (idx * 5), top: c.y + 5 + (idx * 5) });
                    tilePath.push(i);
                }
            }
        } else {
            const c = tileCoordinates[newPos];
            if (c) {
                newPath.push({ left: c.x + 13 + (idx * 5), top: c.y + 5 + (idx * 5) });
                tilePath.push(newPos);
            }
        }

        // Dynamic hop speed — faster for longer distances
        const hopSpeed = newPath.length > 16 ? 100 : newPath.length > 9 ? 150 : 200;
        hopSpeedRef.current = hopSpeed;

        // Always update path coords so the avatar actually moves
        setPathCoords(newPath);
        prevPosRef.current = newPos;

        if (newPath.length > 1) {
            // It's a multi-tile hop — play hop sound + notify camera at each step
            let hopIndex = 1; // Start at 1 to skip the starting position
            const hopInterval = setInterval(() => {
                if (hopIndex < newPath.length) {
                    onHopSfx();
                    // Notify parent about current tile for camera follow (every 3 tiles)
                    if (onHopStep && tilePath[hopIndex] && hopIndex % 3 === 0) {
                        onHopStep(tilePath[hopIndex]);
                    }
                    hopIndex++;
                } else {
                    clearInterval(hopInterval);
                }
            }, hopSpeed);
            
            // Clean up on unmount or new animation
            return () => clearInterval(hopInterval);
        }
    }, [p.pos, idx, tileCoordinates, onHopSfx, onHopStep]);

    if (pathCoords.length === 0) return null;

    const name = p.name || `Player ${p.id}`;
    const initials = name.substring(0, 2).toUpperCase();

    const lefts = pathCoords.map(c => `${c.left}px`);
    const tops = pathCoords.map(c => `${c.top}px`);
    const scales = pathCoords.map((_, i) => i === pathCoords.length - 1 ? 1 : 1.2);
    const scaleY = pathCoords.map((_, i) => i === pathCoords.length - 1 ? 1 : 0.8);

    return (
        <motion.div
            key={p.id}
            layoutId={`avatar-${p.id}`}
            initial={false}
            animate={{
                left: lefts, 
                top: tops,
                scale: scales,
                scaleY: scaleY,
                z: 60
            }}
            transition={{ 
                duration: pathCoords.length > 1 ? pathCoords.length * (hopSpeedRef.current / 1000) : 0.5,
                ease: "easeInOut" 
            }}
            className="absolute"
            style={{ zIndex: 600 + idx, transformStyle: 'preserve-3d' }}
        >
            <div 
                className="avatar-bubble"
                style={{ transform: 'rotateZ(30deg) rotateX(-50deg)' }}
            >
                {p.activeEffect && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-pulse whitespace-nowrap">
                        ⚡ IF-ELSE
                    </div>
                )}
                <div className="text-[9px] font-bold text-slate-800 mb-1 leading-none absolute -top-4 w-max px-1 bg-white/90 rounded border border-slate-200">
                    {name.substring(0, 8)}
                </div>
                <div className="avatar-img shadow-lg" style={{ backgroundColor: p.color, color: 'white' }}>
                    {initials}
                </div>
            </div>
        </motion.div>
    );
}

export default function Game({ room, currentUser, isOwner }: { room: Room, currentUser: any, isOwner: boolean }) {
    const [gameState, setGameState] = useState<GameState>(room.game_state);
    const [loading, setLoading] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false); // Blocks interactions during movement animation
    
    // If-Else builder local state
    const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
    const [selectedThen, setSelectedThen] = useState<string | null>(null);
    const [selectedElse, setSelectedElse] = useState<string | null>(null);
    
    // Map Panning State
    const [pan, setPan] = useState({ x: 0, y: -500 });
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const [timeLeft, setTimeLeft] = useState<string>('');
    const [onlineUsers, setOnlineUsers] = useState<number[]>([]);

    const [showDiceAnim, setShowDiceAnim] = useState<{result: number, tumbling: boolean} | null>(null);
    const [showTurnReveal, setShowTurnReveal] = useState(room.game_state.status === 'playing' && room.game_state.log.length <= 1 && room.game_state.players[0].pos === 1);

    const [toasts, setToasts] = useState<ToastData[]>([]);
    const [turnBanner, setTurnBanner] = useState<{name: string, color: string} | null>(null);

    const addToast = (type: ToastType, title: string, message: string) => {
        setToasts(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type, title, message }]);
    };
    
    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };
    useEffect(() => {
        if (showTurnReveal) {
            const t = setTimeout(() => setShowTurnReveal(false), 3000);
            return () => clearTimeout(t);
        }
    }, [showTurnReveal]);
    useHeartbeat(room.code);
    const { playSfx, playBgm, stopBgm, bgmVolume, setBgmVolume, sfxVolume, setSfxVolume } = useSoundEffects();
    const [showSettings, setShowSettings] = useState(false);
    useEffect(() => {
        if (gameState.status === 'playing') {
            playBgm('game');
        } else if (gameState.status === 'finished') {
            playBgm('victory');
        }
        return () => stopBgm();
    }, [gameState.status, playBgm, stopBgm]);
    useEffect(() => {
        if (!room.timer_ends_at || gameState.status === 'finished') {
            setTimeLeft('');
            return;
        }

        const updateTimer = () => {
            const end = new Date(room.timer_ends_at as string).getTime();
            const now = new Date().getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('00:00');
                return;
            }

            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [room.timer_ends_at, gameState.status]);

    useEffect(() => {
        const channel = echo().join(`room.${room.code}`);
        
        const onGameStateUpdated = (e: any) => {
            setGameState(e.gameState);
        };
        const onRoomClosed = () => {
            alert('The game room has been closed.');
            import('@inertiajs/react').then(({ router }) => router.visit('/menu'));
        };
        const onRoomRestarted = () => {
            import('@inertiajs/react').then(({ router }) => router.visit(`/rooms/${room.code}`));
        };

        channel.listen('GameStateUpdated', onGameStateUpdated);
        channel.listen('RoomClosed', onRoomClosed);
        channel.listen('RoomRestarted', onRoomRestarted);

        channel.here((users: any[]) => {
            setOnlineUsers(users.map((u: any) => u.id));
        });

        channel.joining((user: any) => {
            setOnlineUsers(prev => [...prev, user.id]);
        });

        channel.leaving((user: any) => {
            setOnlineUsers(prev => prev.filter(id => id !== user.id));
        });

        return () => {
            channel.stopListening('GameStateUpdated', onGameStateUpdated);
            channel.stopListening('RoomClosed', onRoomClosed);
            channel.stopListening('RoomRestarted', onRoomRestarted);
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

    const [mapZoom, setMapZoom] = useState(1);

    // Center camera on a tile by reading its actual rendered screen position
    const panToTile = (pos: number) => {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
            const el = document.getElementById(`slab-${pos}`);
            if (!el) return;

            const rect = el.getBoundingClientRect();
            const tileCenterX = rect.left + rect.width / 2;
            const tileCenterY = rect.top + rect.height / 2;

            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;

            // Adjust pan by the difference between tile center and screen center
            setPan(prev => ({
                x: prev.x + (screenCenterX - tileCenterX),
                y: prev.y + (screenCenterY - tileCenterY)
            }));
            
            // Add a slight pulse zoom
            setMapZoom(1.03);
            setTimeout(() => setMapZoom(1), 300);
        });
    };

    // Auto-pan: follow the moving player, then switch to the next player with a delay
    const prevTurnIdx = useRef(gameState.currentPlayerIndex);
    const prevPositionsRef = useRef<Record<number, number>>({});
    const initialPanDone = useRef(false);
    const hopFollowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const turnBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Camera follow callback for PlayerAvatar hop steps
    const handleHopStep = useCallback((tilePos: number) => {
        panToTile(tilePos);
    }, []);

    useEffect(() => {
        if (!gameState || !gameState.players) return;
        const cp = gameState.players[gameState.currentPlayerIndex];
        if (!cp) return;

        // Clear any pending timers from previous updates
        if (hopFollowTimer.current) { clearTimeout(hopFollowTimer.current); hopFollowTimer.current = null; }
        if (turnBannerTimer.current) { clearTimeout(turnBannerTimer.current); turnBannerTimer.current = null; }

        const turnChanged = prevTurnIdx.current !== gameState.currentPlayerIndex;

        // Detect which player moved and by how much
        let movedPlayerPos = -1;
        let movedPlayerOldPos = -1;
        let hopDistance = 0;

        gameState.players.forEach(p => {
            const oldPos = prevPositionsRef.current[p.id];
            if (oldPos !== undefined && oldPos !== p.pos) {
                const dist = Math.abs(p.pos - oldPos);
                if (dist > hopDistance) {
                    hopDistance = dist;
                    movedPlayerPos = p.pos;
                    movedPlayerOldPos = oldPos;
                }
            }
        });

        // Calculate hop animation duration (must match PlayerAvatar's timing)
        const isHopping = hopDistance > 0 && hopDistance <= 25;
        const pathLen = hopDistance + 1;
        const hopSpeed = pathLen > 16 ? 100 : pathLen > 9 ? 150 : 200;
        const hopDuration = isHopping ? pathLen * hopSpeed + 400 : 0;
        const TURN_DELAY = 1500; // Delay between moves for dramatic effect

        // Initialize positions on first render
        if (Object.keys(prevPositionsRef.current).length === 0) {
            const positions: Record<number, number> = {};
            gameState.players.forEach(p => { positions[p.id] = p.pos; });
            prevPositionsRef.current = positions;
        }

        if (isHopping && movedPlayerOldPos > 0) {
            // Lock interactions during the entire animation sequence
            setIsAnimating(true);

            // Pan camera to the destination — the CSS transition makes it smooth
            panToTile(movedPlayerPos);

            // After the hop animation + turn delay, show turn banner and unlock
            if (turnChanged) {
                hopFollowTimer.current = setTimeout(() => {
                    setTurnBanner({ name: cp.name || `Player ${cp.id}`, color: cp.color });
                    playSfx('turn-start');
                    turnBannerTimer.current = setTimeout(() => setTurnBanner(null), 2500);
                    panToTile(cp.pos);
                    // Unlock interactions after camera settles
                    setTimeout(() => setIsAnimating(false), 800);
                }, hopDuration + TURN_DELAY);
            } else {
                // Same player moved (e.g. snake/ladder follow-up), just unlock after animation
                hopFollowTimer.current = setTimeout(() => {
                    setIsAnimating(false);
                }, hopDuration + 500);
            }
        } else if (hopDistance > 25 && movedPlayerPos > 0) {
            // Large teleport (snake/ladder) — cinematic pan to destination
            setIsAnimating(true);
            panToTile(movedPlayerPos);

            if (turnChanged) {
                hopFollowTimer.current = setTimeout(() => {
                    setTurnBanner({ name: cp.name || `Player ${cp.id}`, color: cp.color });
                    playSfx('turn-start');
                    turnBannerTimer.current = setTimeout(() => setTurnBanner(null), 2500);
                    panToTile(cp.pos);
                    setTimeout(() => setIsAnimating(false), 800);
                }, 1500 + TURN_DELAY);
            } else {
                hopFollowTimer.current = setTimeout(() => {
                    setIsAnimating(false);
                }, 2000);
            }
        } else {
            // No hop animation — handle turn change and camera immediately
            if (turnChanged) {
                setTurnBanner({ name: cp.name || `Player ${cp.id}`, color: cp.color });
                playSfx('turn-start');
                turnBannerTimer.current = setTimeout(() => setTurnBanner(null), 2500);
            }

            if (turnChanged || (!initialPanDone.current && Object.keys(tileCoordinates).length > 0)) {
                panToTile(cp.pos);
                if (Object.keys(tileCoordinates).length > 0) {
                    initialPanDone.current = true;
                }
            }
        }

        // Update tracked positions and turn index
        const newPositions: Record<number, number> = {};
        gameState.players.forEach(p => { newPositions[p.id] = p.pos; });
        prevPositionsRef.current = newPositions;
        prevTurnIdx.current = gameState.currentPlayerIndex;

        return () => {
            if (hopFollowTimer.current) clearTimeout(hopFollowTimer.current);
        };
    }, [gameState.currentPlayerIndex, gameState.players, tileCoordinates, playSfx]);

    const prevPhase = useRef(gameState.phase);
    useEffect(() => {
        if (prevPhase.current === 'roll' && gameState.phase === 'action' && gameState.lastRoll !== null) {
            playSfx('dice-roll');
            setShowDiceAnim({ result: gameState.lastRoll, tumbling: true });
            setTimeout(() => {
                setShowDiceAnim(prev => prev ? {...prev, tumbling: false} : null);
                playSfx('dice-land');
            }, 1500);
            setTimeout(() => setShowDiceAnim(null), 2500);
        }
        prevPhase.current = gameState.phase;
    }, [gameState.phase, gameState.lastRoll, playSfx]);

    const prevLogLen = useRef(gameState.log.length);
    useEffect(() => {
        if (gameState.log.length > prevLogLen.current) {
            const newLogs = gameState.log.slice(prevLogLen.current);
            newLogs.forEach(log => {
                // Ladder events
                if (log.includes('found a LADDER') || log.includes('teleported to ladder') || log.includes('climbed to tile')) {
                    addToast('success', '🪜 Ladder!', log);
                    playSfx('ladder-climb');
                }
                // Snake events
                else if (log.includes('landed on a SNAKE') || log.includes('teleported to snake') || log.includes('slid down to tile')) {
                    addToast('danger', '🐍 Snake!', log);
                    playSfx('snake-slide');
                }
                // IF-ELSE trap set (warning) — no trap SFX here, just a subtle click
                else if (log.includes('set IF-ELSE trap')) {
                    addToast('warning', '⚠️ Trap Set!', log);
                    playSfx('click');
                }
                // IF-ELSE trap triggered
                else if (log.includes('IF-ELSE trap triggered')) {
                    addToast('warning', '⚡ Trap Triggered!', log);
                    playSfx('trap-activate');
                }
                // IF-ELSE trap expired (ELSE activating)
                else if (log.includes('IF-ELSE trap expired')) {
                    addToast('info', '🔄 Trap Expired', log);
                    playSfx('trap-activate');
                }
                // Stomp/collision events
                else if (log.includes('stomped on')) {
                    addToast('danger', '⚔️ Stomped!', log);
                    playSfx('stomp');
                }
                // Elimination
                else if (log.includes('ELIMINATED') || log.includes('has been eliminated')) {
                    addToast('elimination', '💀 Eliminated!', log);
                    playSfx('error');
                }
                // HP loss (sent back to start)
                else if (log.includes('-1 HP') || log.includes('sent back to START')) {
                    addToast('danger', '💔 HP Lost!', log);
                    playSfx('hp-loss');
                }
                // Victory / finish line
                else if (log.includes('WINS') || log.includes('WINNER') || log.includes('Game Over')) {
                    addToast('victory', '🏆 Game Over!', log);
                    playSfx('success');
                }
                else if (log.includes('crossed the FINISH LINE')) {
                    addToast('victory', '🏁 Finished!', log);
                    playSfx('success');
                }
                // Kicked back
                else if (log.includes('Kicked') && log.includes('back')) {
                    addToast('danger', '💥 Kicked!', log);
                    playSfx('hp-loss');
                }
                // Generic movement
                else if (log.includes('moved to') || log.includes('moved') && log.includes('tiles')) {
                    playSfx('click');
                }
            });
        }
        prevLogLen.current = gameState.log.length;
    }, [gameState.log, playSfx]);

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

    const handleHopSfx = useCallback(() => {
        playSfx('hop');
    }, [playSfx]);

    const renderAvatars = () => {
        return gameState.players.filter(p => p.alive).map((p, idx) => (
            <PlayerAvatar key={p.id} p={p} idx={idx} tileCoordinates={tileCoordinates} onHopSfx={handleHopSfx} onHopStep={handleHopStep} />
        ));
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
    const isMyTurn = currentPlayer?.user_id === currentUser.id && currentPlayer?.alive;

    return (
        <>
            <Head title={`Game ${room.code} - Algo Ladders`} />
            <div 
                className="game-viewport bg-gradient-to-br from-sky-200 via-green-100 to-emerald-200" 
            >
                
                {/* Timer Overlay */}
                {timeLeft && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                        <div className="bg-[#2b2926]/90 backdrop-blur-md px-8 py-3 rounded-2xl border-2 border-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                            <div className="text-xs font-bold text-gray-400 text-center mb-1 tracking-widest uppercase">Time Remaining</div>
                            <div className="text-3xl font-black text-primary font-mono tabular-nums">{timeLeft}</div>
                        </div>
                    </div>
                )}

                {/* Left Panel: Players & Log Overlay */}
                <div className="absolute left-4 top-4 bottom-4 w-72 flex flex-col gap-4 z-50 pointer-events-none">
                    <div className="bg-[#2b2926]/90 backdrop-blur-md p-5 rounded-2xl border border-[#45423d] shadow-2xl pointer-events-auto">
                        <h2 className="text-xl font-black italic tracking-tight text-white mb-4">PLAYERS</h2>
                        <div className="space-y-3">
                            {gameState.players.map((p, i) => {
                                const isOnline = onlineUsers.includes(p.user_id);
                                return (
                                    <div 
                                        key={p.id} 
                                        className={`p-3 rounded-xl border-l-4 transition-all ${!p.alive ? 'opacity-40 grayscale' : (!isOnline ? 'opacity-60 border-gray-500' : '')} ${i === gameState.currentPlayerIndex && isOnline ? 'bg-[#3d3a36] scale-105 shadow-md' : 'bg-[#1e1c1a]'}`}
                                        style={{ borderColor: !isOnline && p.alive ? '#6b7280' : p.color }}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-sm text-white truncate max-w-[120px]">
                                                {p.name || `Player ${p.id}`} {p.user_id === currentUser.id && '(You)'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {!isOnline && p.alive && <span className="text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded font-bold">OFFLINE</span>}
                                                <span className="text-xs font-mono bg-black/40 px-2 py-0.5 rounded text-gray-300">Pos: {p.pos}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            {Array.from({ length: 3 }).map((_, idx) => (
                                                <motion.span 
                                                    key={`${p.id}-${idx}-${idx < p.hp}`}
                                                    initial={{ scale: 2, rotate: -20, opacity: 0 }}
                                                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                                                    className="text-sm inline-block"
                                                >
                                                    {idx < p.hp ? '❤️' : '🖤'}
                                                </motion.span>
                                            ))}
                                        </div>
                                        {p.activeEffect && (
                                            <div className="text-[9px] text-blue-400 mt-1 font-bold">⚡ IF-ELSE ACTIVE</div>
                                        )}
                                    </div>
                                );
                            })}
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
                            transform: `translate(${pan.x}px, ${pan.y}px) rotateX(50deg) rotateZ(-30deg) scale3d(${mapZoom}, ${mapZoom}, ${mapZoom})`,
                            transition: isDragging.current ? 'none' : 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)'
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

                {/* Game End Overlay */}
                {gameState.status === 'finished' && (
                    <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#2b2926] p-8 rounded-3xl border border-[#45423d] text-center max-w-md w-full mx-4">
                            <div className="text-6xl mb-3">🏆</div>
                            <h2 className="text-2xl font-black text-white mb-1">{gameState.winner ? `${gameState.winner} Wins!` : 'No Winner!'}</h2>
                            <p className="text-gray-500 text-sm mb-5">Final Rankings</p>
                            
                            <div className="space-y-2 mb-6">
                                {(gameState.rankings || []).map((r, i) => {
                                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
                                    const playerData = gameState.players.find(p => p.name === r.name);
                                    return (
                                        <motion.div key={r.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
                                            className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-[#1e1c1a] border-[#45423d]'}`}>
                                            <span className="text-2xl">{medal}</span>
                                            <div className="flex-1 text-left">
                                                <span className="font-bold text-white text-sm">{r.name}</span>
                                            </div>
                                            <span className="text-xs font-mono text-gray-400">
                                                {playerData?.pos ? `Tile ${playerData.pos}` : ''}
                                            </span>
                                        </motion.div>
                                    );
                                })}
                                {/* Show eliminated players at the bottom */}
                                {gameState.players.filter(p => !p.alive && !(gameState.rankings || []).find(r => r.name === p.name)).map(p => (
                                    <div key={p.name} className="flex items-center gap-3 p-3 rounded-xl bg-[#1e1c1a] border border-[#45423d] opacity-50">
                                        <span className="text-2xl">💀</span>
                                        <span className="font-bold text-gray-500 text-sm flex-1 text-left">{p.name}</span>
                                        <span className="text-xs text-gray-600">Eliminated</span>
                                    </div>
                                ))}
                            </div>

                            {isOwner ? (
                                <div className="flex flex-col gap-2 w-full mt-4">
                                    <button onClick={() => router.post(`/rooms/${room.code}/start`)} className="bg-primary text-primary-foreground px-8 py-3 font-bold rounded-xl w-full hover:bg-primary/90 transition-colors">
                                        RETURN TO LOBBY (RESTART)
                                    </button>
                                    <button onClick={() => router.visit('/menu')} className="bg-[#45423d] text-white px-8 py-3 font-bold rounded-xl w-full hover:bg-[#524e49] transition-colors">
                                        LEAVE ROOM TO MENU
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 w-full mt-4">
                                    <p className="text-xs text-gray-400 mb-1">Waiting for owner to restart...</p>
                                    <button onClick={() => router.visit('/menu')} className="bg-[#45423d] text-white px-8 py-3 font-bold rounded-xl w-full hover:bg-[#524e49] transition-colors">
                                        LEAVE ROOM TO MENU
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}

                {/* Bottom Panel */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto max-w-lg w-full px-4">
                    <div className="bg-[#2b2926] p-6 rounded-3xl border border-[#45423d] shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col items-center">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">
                            Current Turn: <span style={{ color: currentPlayer?.color }}>{currentPlayer?.name}</span>
                            {gameState.lastRoll && <span className="ml-3 text-yellow-400">🎲 {gameState.lastRoll}</span>}
                        </div>
                        
                        {isMyTurn && gameState.status === 'playing' ? (
                            <div className="w-full flex flex-col items-center gap-3 mt-2">
                                
                                {/* PHASE: SELECT POWER */}
                                {gameState.phase === 'select' && (
                                    <div className="flex gap-2">
                                        {(['math', 'ifelse', 'forloop'] as const).map(p => (
                                            <button key={p} disabled={loading || isAnimating} onClick={() => { playSfx('power-select'); setLoading(true); router.post(`/rooms/${room.code}/select-power`, { power: p }, { preserveState: true, onFinish: () => setLoading(false) }); }}
                                                className="bg-[#3d3a36] hover:bg-[#81b64c] p-3 rounded-xl flex flex-col items-center transition-colors border border-[#45423d] min-w-[70px] disabled:opacity-50">
                                                <span className="text-xl mb-1">{p === 'math' ? '➕' : p === 'ifelse' ? '🌿' : '🔁'}</span>
                                                <span className="text-[10px] font-bold text-white">{p === 'math' ? 'MATH' : p === 'ifelse' ? 'IF-ELSE' : 'FOR'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* PHASE: ROLL DICE */}
                                {gameState.phase === 'roll' && (
                                    <button disabled={loading || isAnimating} onClick={() => { playSfx('click'); setLoading(true); router.post(`/rooms/${room.code}/roll`, {}, { preserveState: true, onFinish: () => setLoading(false) }); }}
                                        className="bg-[#81b64c] text-white px-12 py-4 font-black text-xl rounded-xl shadow-[0_5px_0_#4a672d] active:shadow-[0_2px_0_#4a672d] active:translate-y-[3px] transition-all tracking-widest w-full disabled:opacity-50">
                                        🎲 ROLL DICE
                                    </button>
                                )}

                                {/* PHASE: ACTION - MATH */}
                                {gameState.phase === 'action' && gameState.selectedPower === 'math' && (
                                    <div className="w-full">
                                        <p className="text-gray-400 text-xs text-center mb-2">Dice: {gameState.lastRoll} • Tile Value: {gameState.tileValues[currentPlayer?.pos || 0] || 0}</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {['+', '-', '*', '/'].map(op => (
                                                <button key={op} disabled={loading || isAnimating} onClick={() => { setLoading(true); router.post(`/rooms/${room.code}/action`, { operator: op }, { preserveState: true, onFinish: () => setLoading(false) }); }}
                                                    className="bg-blue-600 hover:bg-blue-500 p-3 rounded-xl font-black text-2xl text-white transition-colors disabled:opacity-50">
                                                    {op === '*' ? '×' : op === '/' ? '÷' : op}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* PHASE: ACTION - FOR LOOP */}
                                {gameState.phase === 'action' && gameState.selectedPower === 'forloop' && (
                                    <div className="w-full text-center">
                                        <p className="text-gray-300 text-sm mb-3">Loop {Math.min(gameState.tileValues[currentPlayer?.pos || 0] || 1, 3)}× moving {gameState.lastRoll} tiles each</p>
                                        <button disabled={loading || isAnimating} onClick={() => { playSfx('click'); setLoading(true); router.post(`/rooms/${room.code}/action`, {}, { preserveState: true, onFinish: () => setLoading(false) }); }}
                                            className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 font-bold rounded-xl w-full disabled:opacity-50">
                                            🔁 START LOOP
                                        </button>
                                    </div>
                                )}

                                {/* PHASE: ACTION - IF-ELSE BUILDER */}
                                {gameState.phase === 'action' && gameState.selectedPower === 'ifelse' && gameState.ifelseOptions && (
                                    <div className="w-full space-y-3 max-h-[300px] overflow-y-auto">
                                        <div className="bg-[#1e1c1a] p-3 rounded-xl border border-[#45423d]">
                                            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-2">1. IF Condition</p>
                                            {gameState.ifelseOptions.conditions.map(c => (
                                                <button key={c.id} onClick={() => setSelectedCondition(c.id)}
                                                    className={`w-full text-left p-2 rounded-lg text-xs mb-1 transition-colors ${selectedCondition === c.id ? 'bg-blue-600 text-white' : 'bg-[#2b2926] text-gray-300 hover:bg-[#3d3a36]'}`}>
                                                    {c.text}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="bg-[#1e1c1a] p-3 rounded-xl border border-[#45423d]">
                                            <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-2">2. THEN Output</p>
                                            {[...gameState.ifelseOptions.positive, ...gameState.ifelseOptions.neutral].map(o => (
                                                <button key={o.id} onClick={() => setSelectedThen(o.id)}
                                                    className={`w-full text-left p-2 rounded-lg text-xs mb-1 transition-colors ${selectedThen === o.id ? 'bg-emerald-600 text-white' : 'bg-[#2b2926] text-gray-300 hover:bg-[#3d3a36]'}`}>
                                                    {o.text}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="bg-[#1e1c1a] p-3 rounded-xl border border-[#45423d]">
                                            <p className="text-rose-400 text-[10px] font-bold uppercase tracking-widest mb-2">3. ELSE Output</p>
                                            {[...gameState.ifelseOptions.negative, ...gameState.ifelseOptions.neutral].map(o => (
                                                <button key={o.id} onClick={() => setSelectedElse(o.id)}
                                                    className={`w-full text-left p-2 rounded-lg text-xs mb-1 transition-colors ${selectedElse === o.id ? 'bg-rose-600 text-white' : 'bg-[#2b2926] text-gray-300 hover:bg-[#3d3a36]'}`}>
                                                    {o.text}
                                                </button>
                                            ))}
                                        </div>
                                        <button disabled={loading || isAnimating || !selectedCondition || !selectedThen || !selectedElse}
                                            onClick={() => { playSfx('click'); setLoading(true); router.post(`/rooms/${room.code}/action`, { condition: selectedCondition, then_output: selectedThen, else_output: selectedElse }, { preserveState: true, onFinish: () => { setLoading(false); setSelectedCondition(null); setSelectedThen(null); setSelectedElse(null); } }); }}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 font-bold rounded-xl w-full disabled:opacity-50">
                                            COMPILE & RUN
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : gameState.status === 'playing' ? (
                            <div className="w-full text-center mt-4">
                                <p className="text-gray-400 animate-pulse font-bold text-sm tracking-widest">WAITING...</p>
                            </div>
                        ) : null}
                        
                        {gameState.status === 'playing' && (
                            <div className="flex justify-between items-center mt-4">
                                <button 
                                    onClick={() => { if (confirm('Are you sure you want to surrender?')) router.post(`/rooms/${room.code}/leave`); }}
                                    className="text-[#ef4444] hover:text-[#f87171] font-bold text-xs flex items-center gap-2 transition-colors">
                                    🏳️ SURRENDER
                                </button>
                                <button 
                                    onClick={() => { playSfx('click'); setShowSettings(true); }}
                                    className="text-gray-400 hover:text-white transition-colors p-2 bg-[#1e1c1a] rounded-full border border-[#45423d]">
                                    <Settings className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </div>
            
            <GameToast toasts={toasts} removeToast={removeToast} />

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto"
                    >
                        <div 
                            className="bg-[#2b2926] p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-[#45423d] relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button 
                                onClick={() => setShowSettings(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h2 className="text-2xl font-black italic text-white mb-6">SETTINGS</h2>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Music Volume</label>
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
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">SFX Volume</label>
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

            <AnimatePresence>
                {turnBanner && (
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-20 left-0 right-0 z-[150] flex justify-center pointer-events-none"
                    >
                        <div 
                            className="px-12 py-4 rounded-full shadow-2xl backdrop-blur-md border-b-4"
                            style={{ backgroundColor: `${turnBanner.color}dd`, borderColor: turnBanner.color }}
                        >
                            <h2 className="text-3xl font-black text-white uppercase tracking-widest drop-shadow-md">
                                {turnBanner.name}'S TURN
                            </h2>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Turn Order Reveal Overlay */}
            <AnimatePresence>
                {showTurnReveal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
                    >
                        <h2 className="text-4xl font-black text-white mb-12 tracking-widest">TURN ORDER</h2>
                        <div className="flex flex-wrap justify-center gap-6 px-4">
                            {gameState.players.map((p, i) => (
                                <div key={p.id} className="turn-card-container">
                                    <div className="turn-card turn-card-reveal" style={{ animationDelay: `${i * 0.4}s` }}>
                                         <div className="turn-card-front text-6xl">?</div>
                                         <div className="turn-card-back" style={{ borderColor: p.color }}>
                                             <div className="text-6xl font-black mb-2" style={{ color: p.color }}>{i + 1}</div>
                                             <div className="text-sm font-bold text-center px-2 text-slate-800">{p.name}</div>
                                         </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dice Tumble & Result Overlay */}
            <AnimatePresence>
                {showDiceAnim && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
                    >
                        <div className={`dice-container ${showDiceAnim.tumbling ? 'block' : 'hidden'}`}>
                            <div className="dice tumbling">
                                {[1,2,3,4,5,6].map(i => (
                                    <div key={i} className={`dice-face dice-face-${i}`}>
                                        {Array.from({ length: i }).map((_, dotIdx) => (
                                            <span key={dotIdx} className="dot"></span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Result Phase */}
                        {!showDiceAnim.tumbling && (
                            <motion.div 
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1.5, rotate: 0 }}
                                className="w-32 h-32 bg-white rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.5)] flex items-center justify-center border-8 border-primary p-4"
                            >
                                <DiceFace value={showDiceAnim.result} size={80} />
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

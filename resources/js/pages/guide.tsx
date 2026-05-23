import { Head, Link } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Dice5, Zap, ShieldAlert, Users, Trophy, Play, RotateCcw, Volume2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useSoundEffects } from '../hooks/useSoundEffects';

// DiceFace - renders dice dots pattern matching game.tsx
function DiceFace({ value, size = 80 }: { value: number; size?: number }) {
    const dotSize = size * 0.16;
    const pad = size * 0.22;
    const mid = size / 2;

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

// Reusable interactive 3D map container with Pan and Zoom
function InteractivePreview({ children, defaultWidth = 300, defaultHeight = 120, defaultScale = 0.95, containerHeight = 140 }: any) {
    const [zoom, setZoom] = useState(defaultScale);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        setPan(p => ({
            x: p.x + (e.clientX - lastPos.current.x),
            y: p.y + (e.clientY - lastPos.current.y)
        }));
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    return (
        <div 
            className="relative w-full bg-background/50 rounded-2xl overflow-hidden flex items-center justify-center perspective-container border border-border/50 touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ height: `${containerHeight}px` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={(e) => {
                // Only allow zooming if they are hovering the map (prevents whole page scrolling from being blocked unnecessarily, but since touch-none is on, it's fine)
                // We shouldn't prevent default on wheel unless we're strictly zooming, to allow normal page scroll
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    e.preventDefault();
                    setZoom(z => Math.max(0.5, Math.min(2, z - e.deltaY * 0.002)));
                } else {
                    // Just zoom normally on wheel to make it easy for mouse users
                    e.preventDefault();
                    setZoom(z => Math.max(0.5, Math.min(2, z - e.deltaY * 0.001)));
                }
            }}
        >
            <div className="absolute top-2 right-2 flex gap-1 z-50 bg-card/80 p-1 rounded-lg backdrop-blur shadow border border-border">
                <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="p-1 hover:bg-white/10 rounded text-foreground transition-colors"><ZoomIn size={14}/></button>
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-1 hover:bg-white/10 rounded text-foreground transition-colors"><ZoomOut size={14}/></button>
            </div>

            <div 
                className="map-container" 
                style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px) rotateX(50deg) rotateZ(-30deg) scale3d(${zoom}, ${zoom}, ${zoom})`,
                    width: `${defaultWidth}px`, 
                    height: `${defaultHeight}px`,
                    transition: isDragging.current ? 'none' : 'transform 0.1s ease-out' 
                }}
            >
                {children}
            </div>
        </div>
    );
}

// Basics Preview: Roll and hop step-by-step
function BasicsPreview({ playSfx }: { playSfx: any }) {
    const [tile, setTile] = useState(1);
    const [diceVal, setDiceVal] = useState(1);
    const [isRolling, setIsRolling] = useState(false);
    const [isHopping, setIsHopping] = useState(false);

    const miniCoords = [
        { x: 30, y: 50 },
        { x: 100, y: 50 },
        { x: 170, y: 50 },
        { x: 240, y: 50 },
    ];

    const rollAndMove = () => {
        if (isRolling || isHopping) return;
        setIsRolling(true);
        playSfx('dice-roll');
        
        let rolls = 0;
        const interval = setInterval(() => {
            setDiceVal(Math.floor(Math.random() * 3) + 1);
            rolls++;
            if (rolls > 8) {
                clearInterval(interval);
                const finalRoll = Math.floor(Math.random() * 3) + 1;
                setDiceVal(finalRoll);
                setIsRolling(false);
                playSfx('dice-land');

                setIsHopping(true);
                let currentStep = 0;
                let currentTile = tile;
                
                const hopInterval = setInterval(() => {
                    if (currentStep < finalRoll) {
                        currentTile = currentTile + 1;
                        if (currentTile > 4) {
                            currentTile = 1;
                        }
                        setTile(currentTile);
                        playSfx('hop');
                        currentStep++;
                    } else {
                        clearInterval(hopInterval);
                        setIsHopping(false);
                    }
                }, 400);
            }
        }, 120);
    };

    return (
        <div className="flex flex-col items-center gap-6 p-5 bg-card/50 rounded-3xl border border-border shadow-inner w-full max-w-sm mx-auto">
            <InteractivePreview defaultWidth={300} defaultHeight={120} defaultScale={0.95} containerHeight={140}>
                    {miniCoords.map((c, i) => (
                        <div 
                            key={i} 
                            className="slab terrain-grass"
                            style={{ left: `${c.x}px`, top: `${c.y}px`, width: '50px', height: '50px' }}
                        >
                            <div className="slab-side" style={{ height: '8px', bottom: '-4px' }}></div>
                            <div className="slab-top terrain-grass flex items-center justify-center" style={{ transform: 'translateZ(8px)' }}>
                                <span className="text-[11px] font-black text-white/95">{i + 1}</span>
                            </div>
                        </div>
                    ))}

                    <motion.div
                        animate={{ 
                            left: miniCoords[tile - 1].x + 9,
                            top: miniCoords[tile - 1].y + 9,
                            z: 30
                        }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="absolute"
                        style={{ transformStyle: 'preserve-3d', zIndex: 100 }}
                    >
                        <div className="avatar-bubble" style={{ width: '32px', height: '32px', padding: '1px', transform: 'rotateZ(30deg) rotateX(-50deg)' }}>
                            <div className="avatar-img shadow-lg bg-[#81b64c] text-white text-[12px] font-bold">
                                P1
                            </div>
                        </div>
                    </motion.div>
            </InteractivePreview>

            <div className="flex items-center gap-5">
                <motion.div
                    animate={isRolling ? { rotate: [0, 360, 720, 1080], scale: [1, 1.2, 1] } : {}}
                    className="w-12 h-12 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center"
                >
                    <DiceFace value={diceVal} size={36} />
                </motion.div>

                <button 
                    onClick={rollAndMove}
                    disabled={isRolling || isHopping}
                    className="px-5 py-2.5 bg-[#81b64c] hover:bg-[#81b64c]/90 text-white font-black text-xs rounded-xl shadow-[0_3px_0_#4a672d] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
                >
                    ROLL & MOVE
                </button>
            </div>
        </div>
    );
}

// Math power interactive sandbox
function MathPowerPreview({ playSfx }: { playSfx: any }) {
    const [tile, setTile] = useState(1);
    const [op, setOp] = useState<string | null>(null);
    const [isHopping, setIsHopping] = useState(false);
    const [moveCount, setMoveCount] = useState<number | null>(null);

    const miniCoords = [
        { x: 20, y: 50 },
        { x: 80, y: 50 },
        { x: 140, y: 50, val: 3, terrain: 'mud' }, 
        { x: 200, y: 50 },
        { x: 260, y: 50 },
    ];

    const handleOperator = (selectedOp: string) => {
        if (isHopping) return;
        playSfx('click');
        setOp(selectedOp);
        
        let result = 0;
        const dice = 4;
        const tileVal = 3;

        if (selectedOp === '+') result = dice + tileVal;
        else if (selectedOp === '-') result = dice - tileVal;
        else if (selectedOp === '*') result = dice * tileVal;
        else if (selectedOp === '/') result = Math.floor(dice / tileVal);

        setMoveCount(result);
        setIsHopping(true);

        let currentStep = 0;
        let currentTile = tile;

        const hopInterval = setInterval(() => {
            if (currentStep < result) {
                currentTile = (currentTile % 5) + 1;
                setTile(currentTile);
                playSfx('hop');
                currentStep++;
            } else {
                clearInterval(hopInterval);
                setIsHopping(false);
            }
        }, 300);
    };

    return (
        <div className="flex flex-col items-center gap-4 w-full">
            <p className="text-[11px] text-muted-foreground text-center font-medium max-w-xs">
                Alter your dice roll using the operator value of your landing tile (3)!
            </p>
            
            <InteractivePreview defaultWidth={300} defaultHeight={120} defaultScale={0.95} containerHeight={140}>
                    {miniCoords.map((c, i) => {
                        const isMud = c.terrain === 'mud';
                        const terrainClass = isMud ? 'terrain-mud' : 'terrain-grass';
                        return (
                            <div 
                                key={i} 
                                className={`slab ${terrainClass}`}
                                style={{ left: `${c.x}px`, top: `${c.y}px`, width: '45px', height: '45px' }}
                            >
                                <div className="slab-side" style={{ height: '8px', bottom: '-4px' }}></div>
                                <div className={`slab-top ${terrainClass} flex flex-col items-center justify-center`} style={{ transform: 'translateZ(8px)' }}>
                                    <span className="text-[9px] font-black text-white/95">{i + 1}</span>
                                    {c.val && <span className="text-[7px] font-bold text-yellow-300">val: {c.val}</span>}
                                </div>
                            </div>
                        );
                    })}

                    <motion.div
                        animate={{ 
                            left: miniCoords[tile - 1].x + 6,
                            top: miniCoords[tile - 1].y + 6,
                            z: 30
                        }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="absolute"
                        style={{ transformStyle: 'preserve-3d', zIndex: 100 }}
                    >
                        <div className="avatar-bubble" style={{ width: '32px', height: '32px', padding: '1px', transform: 'rotateZ(30deg) rotateX(-50deg)' }}>
                            <div className="avatar-img shadow-lg bg-[#81b64c] text-white text-[12px] font-bold">
                                P1
                            </div>
                        </div>
                    </motion.div>
            </InteractivePreview>

            <div className="flex flex-col items-center gap-2 w-full">
                <div className="flex gap-2 justify-center">
                    {(['+', '-', '*', '/'] as const).map(o => (
                        <button
                            key={o}
                            disabled={isHopping}
                            onClick={() => handleOperator(o)}
                            className="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-colors flex items-center justify-center"
                        >
                            {o === '*' ? '×' : o === '/' ? '÷' : o}
                        </button>
                    ))}
                </div>

                {op && moveCount !== null && (
                    <div className="text-[10px] bg-background px-3 py-1 rounded-lg border border-border font-mono text-center text-blue-500 shadow-sm">
                        Dice (4) {op === '*' ? '×' : op === '/' ? '÷' : op} Tile Val (3) = <span className="text-foreground font-black">{moveCount}</span> moves!
                    </div>
                )}
            </div>
        </div>
    );
}

// For loop powers visualizer
function ForLoopPowerPreview({ playSfx }: { playSfx: any }) {
    const [tile, setTile] = useState(1);
    const [loopIndex, setLoopIndex] = useState<number | null>(null);
    const [diceVal, setDiceVal] = useState<number>(2);
    const [status, setStatus] = useState<'idle' | 'running'>('running');

    const miniCoords = [
        { x: 10, y: 55 },
        { x: 55, y: 55 },
        { x: 100, y: 55 },
        { x: 145, y: 55 },
        { x: 190, y: 55 },
        { x: 235, y: 55 },
        { x: 280, y: 55 },
    ];

    useEffect(() => {
        if (status !== 'running') return;

        let currentTile = 1;
        setTile(currentTile);
        let active = true;
        
        const runLoop = async () => {
            await new Promise(r => setTimeout(r, 1000));
            if (!active) return;
            
            // Loop i = 0
            setLoopIndex(0);
            setDiceVal(2);
            playSfx('dice-roll');
            await new Promise(r => setTimeout(r, 600));
            if (!active) return;
            playSfx('dice-land');
            await new Promise(r => setTimeout(r, 300));
            
            for (let j = 0; j < 2; j++) {
                currentTile++;
                setTile(currentTile);
                playSfx('hop');
                await new Promise(r => setTimeout(r, 400));
                if (!active) return;
            }

            // Loop i = 1
            setLoopIndex(1);
            setDiceVal(1);
            playSfx('dice-roll');
            await new Promise(r => setTimeout(r, 600));
            if (!active) return;
            playSfx('dice-land');
            await new Promise(r => setTimeout(r, 300));

            currentTile++;
            setTile(currentTile);
            playSfx('hop');
            await new Promise(r => setTimeout(r, 400));
            if (!active) return;

            // Loop i = 2
            setLoopIndex(2);
            setDiceVal(3);
            playSfx('dice-roll');
            await new Promise(r => setTimeout(r, 600));
            if (!active) return;
            playSfx('dice-land');
            await new Promise(r => setTimeout(r, 300));

            for (let j = 0; j < 3; j++) {
                currentTile++;
                setTile(currentTile);
                playSfx('hop');
                await new Promise(r => setTimeout(r, 400));
                if (!active) return;
            }

            setLoopIndex(null);
            setStatus('idle');
        };

        runLoop();

        return () => {
            active = false;
        };

    }, [status]);

    return (
        <div className="flex flex-col items-center gap-4 w-full">
            <div className="text-[11px] text-muted-foreground text-center font-medium max-w-xs">
                Loops your turn multiple times! Watch index <code className="text-[#81b64c] font-black">i</code> increment.
            </div>

            <InteractivePreview defaultWidth={320} defaultHeight={110} defaultScale={0.95} containerHeight={140}>
                    {miniCoords.map((c, i) => (
                        <div 
                            key={i} 
                            className="slab terrain-snow"
                            style={{ left: `${c.x}px`, top: `${c.y}px`, width: '38px', height: '38px' }}
                        >
                            <div className="slab-side" style={{ height: '6px', bottom: '-3px' }}></div>
                            <div className="slab-top terrain-snow flex items-center justify-center" style={{ transform: 'translateZ(6px)' }}>
                                <span className="text-[8px] font-black text-white/90">{i + 1}</span>
                            </div>
                        </div>
                    ))}

                    <motion.div
                        animate={{ 
                            left: miniCoords[tile - 1].x + 5,
                            top: miniCoords[tile - 1].y + 5,
                            z: 30
                        }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="absolute"
                        style={{ transformStyle: 'preserve-3d', zIndex: 100 }}
                    >
                        <div className="avatar-bubble" style={{ width: '28px', height: '28px', padding: '1px', transform: 'rotateZ(30deg) rotateX(-50deg)' }}>
                            <div className="avatar-img shadow-lg bg-[#81b64c] text-white text-[10px] font-bold">
                                P1
                            </div>
                        </div>
                    </motion.div>
            </InteractivePreview>

            <div className="flex items-center gap-4 w-full justify-between">
                <div className="text-[10px] font-mono bg-background p-2.5 rounded-lg border border-border flex-1 max-w-[200px] text-foreground shadow-sm">
                    <div className={loopIndex === 0 ? 'text-[#81b64c] font-black bg-white/5 px-1 rounded' : 'text-slate-500'}>
                        i = 0: Roll {loopIndex === 0 ? diceVal : '2'} ➔ Move
                    </div>
                    <div className={loopIndex === 1 ? 'text-[#81b64c] font-black bg-white/5 px-1 rounded' : 'text-slate-500'}>
                        i = 1: Roll {loopIndex === 1 ? diceVal : '1'} ➔ Move
                    </div>
                    <div className={loopIndex === 2 ? 'text-[#81b64c] font-black bg-white/5 px-1 rounded' : 'text-slate-500'}>
                        i = 2: Roll {loopIndex === 2 ? diceVal : '3'} ➔ Move
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    {loopIndex !== null ? (
                        <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center shadow-md animate-pulse">
                            <DiceFace value={diceVal} size={28} />
                        </div>
                    ) : (
                        <button
                            onClick={() => { playSfx('click'); setStatus('running'); }}
                            className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/90 text-white font-black text-[10px] rounded-xl shadow-md flex items-center gap-1"
                        >
                            <RotateCcw className="w-3 h-3" /> REPLAY
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// IF-ELSE power sandbox
function IfElsePowerPreview({ playSfx }: { playSfx: any }) {
    const [tile, setTile] = useState(1);
    const [shielded, setShielded] = useState(false);
    const [isHopping, setIsHopping] = useState(false);

    const miniCoords = [
        { x: 30, y: 50 },
        { x: 110, y: 50 },
        { x: 190, y: 50, hazard: true }, 
    ];

    const triggerSimulation = (testType: 'hazard' | 'normal') => {
        if (isHopping) return;
        setIsHopping(true);
        setShielded(false);
        setTile(1);

        let currentTile = 1;
        const targetTile = testType === 'hazard' ? 3 : 2;

        const interval = setInterval(async () => {
            if (currentTile < targetTile) {
                currentTile++;
                setTile(currentTile);
                playSfx('hop');
            } else {
                clearInterval(interval);
                setIsHopping(false);

                if (testType === 'hazard') {
                    setShielded(true);
                    playSfx('trap-activate');
                    await new Promise(r => setTimeout(r, 600));
                    playSfx('success');
                } else {
                    playSfx('click');
                }
            }
        }, 400);
    };

    return (
        <div className="flex flex-col items-center gap-4 w-full">
            <div className="text-[11px] text-muted-foreground text-center font-medium max-w-xs">
                Build logic gates to protect yourself when landing on hazards or traps!
            </div>

            <InteractivePreview defaultWidth={300} defaultHeight={125} defaultScale={0.95} containerHeight={140}>
                    {miniCoords.map((c, i) => {
                        const isHazard = c.hazard;
                        const terrainClass = isHazard ? 'terrain-mud' : 'terrain-grass';
                        return (
                            <div 
                                key={i} 
                                className={`slab ${terrainClass}`}
                                style={{ left: `${c.x}px`, top: `${c.y}px`, width: '48px', height: '48px' }}
                            >
                                <div className="slab-side" style={{ height: '8px', bottom: '-4px' }}></div>
                                <div className={`slab-top ${terrainClass} flex flex-col items-center justify-center`} style={{ transform: 'translateZ(8px)' }}>
                                    <span className="text-[9px] font-black text-white/95">{i + 1}</span>
                                    {isHazard && <span className="text-[7px] font-black text-red-400">⚠️ TRAP</span>}
                                </div>
                            </div>
                        );
                    })}

                    <motion.div
                        animate={{ 
                            left: miniCoords[tile - 1].x + 8,
                            top: miniCoords[tile - 1].y + 8,
                            z: 30
                        }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="absolute"
                        style={{ transformStyle: 'preserve-3d', zIndex: 100 }}
                    >
                        <div className="avatar-bubble relative" style={{ width: '32px', height: '32px', padding: '1px', transform: 'rotateZ(30deg) rotateX(-50deg)' }}>
                            {shielded && (
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg animate-bounce whitespace-nowrap">
                                    🛡️ SHIELDED
                                </div>
                            )}
                            <div className="avatar-img shadow-lg bg-[#81b64c] text-white text-[12px] font-bold">
                                P1
                            </div>
                        </div>
                    </motion.div>
            </InteractivePreview>

            <div className="flex flex-col gap-2 w-full">
                <div className="text-[9px] font-mono bg-background p-2 rounded-lg border border-border text-center text-foreground shadow-sm">
                    <span className="text-blue-400 font-bold">IF</span> (lands_on === <span className="text-red-400 font-black">"TRAP"</span>) &#123; <span className="text-[#81b64c] font-black">ACTIVATE_SHIELD()</span> &#125;
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => triggerSimulation('hazard')}
                        disabled={isHopping}
                        className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-black text-[10px] rounded-xl shadow-md transition-all uppercase"
                    >
                        TEST TRAP TILE
                    </button>
                    <button
                        onClick={() => triggerSimulation('normal')}
                        disabled={isHopping}
                        className="flex-1 py-2 bg-[#81b64c] hover:bg-[#81b64c]/90 disabled:opacity-50 text-white font-black text-[10px] rounded-xl shadow-md transition-all uppercase"
                    >
                        TEST SAFE TILE
                    </button>
                </div>
            </div>
        </div>
    );
}

// Parent sandbox tabs for Powers
function PowersPreview({ playSfx }: { playSfx: any }) {
    const [subTab, setSubTab] = useState<'math' | 'for' | 'ifelse'>('math');

    return (
        <div className="flex flex-col gap-4 p-5 bg-card/50 rounded-3xl border border-border shadow-inner w-full max-w-sm mx-auto">
            <div className="flex bg-background/80 p-1 rounded-xl border border-border/50">
                {(['math', 'for', 'ifelse'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => { playSfx('click'); setSubTab(t); }}
                        className={`flex-1 py-1.5 rounded-lg font-black text-[10px] transition-all uppercase ${subTab === t ? 'bg-[#81b64c] text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}
                    >
                        {t === 'math' ? '➕ MATH' : t === 'for' ? '🔁 FOR' : '🌿 IF-ELSE'}
                    </button>
                ))}
            </div>

            <div className="min-h-[220px] flex items-center justify-center">
                {subTab === 'math' && <MathPowerPreview playSfx={playSfx} />}
                {subTab === 'for' && <ForLoopPowerPreview playSfx={playSfx} />}
                {subTab === 'ifelse' && <IfElsePowerPreview playSfx={playSfx} />}
            </div>
        </div>
    );
}

// Hazards Preview: Snakes and Ladders
function HazardsPreview({ playSfx }: { playSfx: any }) {
    const [ladderTile, setLadderTile] = useState(1);
    const [snakeTile, setSnakeTile] = useState(4);
    const [activeAnim, setActiveAnim] = useState<'ladder' | 'snake'>('ladder');

    const ladderCoords = [
        { x: 20, y: 130 },  
        { x: 90, y: 130 },  
        { x: 20, y: 60 },   
        { x: 90, y: 60 },   
    ];

    const snakeCoords = [
        { x: 170, y: 130 }, 
        { x: 240, y: 130 }, 
        { x: 170, y: 60 },  
        { x: 240, y: 60 },  
    ];

    useEffect(() => {
        let isCancelled = false;

        const runCycle = async () => {
            while (!isCancelled) {
                // LADDER SEQUENCE
                setActiveAnim('ladder');
                setLadderTile(1);
                await new Promise(r => setTimeout(r, 800));
                if (isCancelled) break;
                
                setLadderTile(2);
                playSfx('hop');
                await new Promise(r => setTimeout(r, 600));
                if (isCancelled) break;

                setLadderTile(4);
                playSfx('ladder-climb');
                await new Promise(r => setTimeout(r, 1600));
                if (isCancelled) break;

                // SNAKE SEQUENCE
                setActiveAnim('snake');
                setSnakeTile(3);
                await new Promise(r => setTimeout(r, 800));
                if (isCancelled) break;

                setSnakeTile(4);
                playSfx('hop');
                await new Promise(r => setTimeout(r, 600));
                if (isCancelled) break;

                setSnakeTile(1);
                playSfx('snake-slide');
                await new Promise(r => setTimeout(r, 2000));
            }
        };

        runCycle();

        return () => {
            isCancelled = true;
        };
    }, []);

    return (
        <div className="flex flex-col items-center gap-4 p-5 bg-card/50 rounded-3xl border border-border shadow-inner w-full max-w-sm mx-auto">
            <p className="text-[11px] text-muted-foreground text-center font-medium max-w-xs">
                Ladders advance you forward, while Snakes slide you backward.
            </p>

            <InteractivePreview defaultWidth={310} defaultHeight={190} defaultScale={0.9} containerHeight={210}>
                    {ladderCoords.map((c, i) => (
                        <div 
                            key={`l-${i}`} 
                            className="slab terrain-grass"
                            style={{ left: `${c.x}px`, top: `${c.y}px`, width: '42px', height: '42px' }}
                        >
                            <div className="slab-side" style={{ height: '6px', bottom: '-3px' }}></div>
                            <div className="slab-top terrain-grass flex items-center justify-center" style={{ transform: 'translateZ(6px)' }}>
                                <span className="text-[8px] font-black text-white/90">{i + 1}</span>
                            </div>
                        </div>
                    ))}

                    {snakeCoords.map((c, i) => (
                        <div 
                            key={`s-${i}`} 
                            className="slab terrain-snow"
                            style={{ left: `${c.x}px`, top: `${c.y}px`, width: '42px', height: '42px' }}
                        >
                            <div className="slab-side" style={{ height: '6px', bottom: '-3px' }}></div>
                            <div className="slab-top terrain-snow flex items-center justify-center" style={{ transform: 'translateZ(6px)' }}>
                                <span className="text-[8px] font-black text-white/90">{i + 11}</span>
                            </div>
                        </div>
                    ))}

                    <svg className="absolute inset-0 pointer-events-none" style={{ transform: 'translateZ(10px)', overflow: 'visible' }}>
                        <line 
                            x1={ladderCoords[1].x + 21} y1={ladderCoords[1].y + 21} 
                            x2={ladderCoords[3].x + 21} y2={ladderCoords[3].y + 21} 
                            stroke="#8b5a2b" strokeWidth="4" strokeLinecap="round" 
                        />
                        <line 
                            x1={ladderCoords[1].x + 7} y1={ladderCoords[1].y + 21} 
                            x2={ladderCoords[3].x + 7} y2={ladderCoords[3].y + 21} 
                            stroke="#8b5a2b" strokeWidth="4" strokeLinecap="round" 
                        />
                        {Array.from({ length: 4 }).map((_, idx) => {
                            const ratio = (idx + 1) / 5;
                            const rx1 = ladderCoords[1].x + 7 + (ladderCoords[3].x - ladderCoords[1].x) * ratio;
                            const ry1 = ladderCoords[1].y + 21 + (ladderCoords[3].y - ladderCoords[1].y) * ratio;
                            return (
                                <line 
                                    key={idx}
                                    x1={rx1} y1={ry1} 
                                    x2={rx1 + 14} y2={ry1} 
                                    stroke="#a67c52" strokeWidth="2.5" 
                                />
                            );
                        })}
                    </svg>

                    <svg className="absolute inset-0 pointer-events-none" style={{ transform: 'translateZ(10px)', overflow: 'visible' }}>
                        <path 
                            d={`M ${snakeCoords[3].x + 21} ${snakeCoords[3].y + 21} Q ${snakeCoords[3].x + 40} ${snakeCoords[3].y + 50} ${snakeCoords[0].x + 21} ${snakeCoords[0].y + 21}`} 
                            fill="none" stroke="#2c5521" strokeWidth="10" strokeLinecap="round" 
                        />
                        <path 
                            d={`M ${snakeCoords[3].x + 21} ${snakeCoords[3].y + 21} Q ${snakeCoords[3].x + 40} ${snakeCoords[3].y + 50} ${snakeCoords[0].x + 21} ${snakeCoords[0].y + 21}`} 
                            fill="none" stroke="#b0c929" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" 
                        />
                        <ellipse cx={snakeCoords[3].x + 21} cy={snakeCoords[3].y + 21} rx="8" ry="6" fill="#2c5521" />
                    </svg>

                    {activeAnim === 'ladder' && (
                        <motion.div
                            animate={{ 
                                left: ladderCoords[ladderTile - 1].x + 7,
                                top: ladderCoords[ladderTile - 1].y + 7,
                                z: 30
                            }}
                            transition={{ duration: ladderTile === 4 ? 1.2 : 0.4, ease: "easeInOut" }}
                            className="absolute"
                            style={{ transformStyle: 'preserve-3d', zIndex: 100 }}
                        >
                            <div className="avatar-bubble" style={{ width: '28px', height: '28px', padding: '1px', transform: 'rotateZ(30deg) rotateX(-50deg)' }}>
                                <div className="avatar-img shadow-lg bg-green-500 text-white text-[10px] font-bold">
                                    P1
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeAnim === 'snake' && (
                        <motion.div
                            animate={{ 
                                left: snakeCoords[snakeTile - 1].x + 7,
                                top: snakeCoords[snakeTile - 1].y + 7,
                                z: 30
                            }}
                            transition={{ duration: snakeTile === 1 ? 1.5 : 0.4, ease: "easeInOut" }}
                            className="absolute"
                            style={{ transformStyle: 'preserve-3d', zIndex: 100 }}
                        >
                            <div className="avatar-bubble" style={{ width: '28px', height: '28px', padding: '1px', transform: 'rotateZ(30deg) rotateX(-50deg)' }}>
                                <div className="avatar-img shadow-lg bg-red-500 text-white text-[10px] font-bold">
                                    P2
                                </div>
                            </div>
                        </motion.div>
                    )}
            </InteractivePreview>

            <div className="text-[10px] font-black text-center px-4 uppercase tracking-widest text-[#81b64c]">
                {activeAnim === 'ladder' ? '🪜 Player 1 Climbs Ladder!' : '🐍 Player 2 Slides Down Snake!'}
            </div>
        </div>
    );
}

// Multiplayer Strategy trap preview
function MultiplayerPreview({ playSfx }: { playSfx: any }) {
    const [step, setStep] = useState(0); 
    const [hp, setHp] = useState(3);
    const [tile, setTile] = useState(1);
    const [trapActive, setTrapActive] = useState(false);
    const [isHopping, setIsHopping] = useState(false);

    const miniCoords = [
        { x: 30, y: 55 },
        { x: 110, y: 55 },
        { x: 190, y: 55 },
    ];

    const runSimulation = async () => {
        if (isHopping || step !== 0) return;
        
        setStep(1);
        playSfx('click');
        await new Promise(r => setTimeout(r, 800));
        setTrapActive(true);
        playSfx('trap-activate');
        
        await new Promise(r => setTimeout(r, 1400));
        
        setStep(2);
        setTile(1);
        setIsHopping(true);
        
        let currentTile = 1;
        const interval = setInterval(async () => {
            if (currentTile < 3) {
                currentTile++;
                setTile(currentTile);
                playSfx('hop');
            } else {
                clearInterval(interval);
                setIsHopping(false);
                setStep(3);
                
                playSfx('trap-activate');
                setHp(2);
                await new Promise(r => setTimeout(r, 600));
                playSfx('hp-loss');
            }
        }, 500);
    };

    const resetSimulation = () => {
        setStep(0);
        setHp(3);
        setTile(1);
        setTrapActive(false);
        setIsHopping(false);
    };

    return (
        <div className="flex flex-col items-center gap-4 p-5 bg-card/50 rounded-3xl border border-border shadow-inner w-full max-w-sm mx-auto">
            <p className="text-[11px] text-muted-foreground text-center font-medium max-w-xs">
                Set IF-ELSE traps on tiles to damage and slow down opponents!
            </p>

            <InteractivePreview defaultWidth={300} defaultHeight={130} defaultScale={0.95} containerHeight={150}>
                    {miniCoords.map((c, i) => (
                        <div 
                            key={i} 
                            className="slab terrain-grass"
                            style={{ left: `${c.x}px`, top: `${c.y}px`, width: '48px', height: '48px' }}
                        >
                            <div className="slab-side" style={{ height: '8px', bottom: '-4px' }}></div>
                            <div className="slab-top terrain-grass flex flex-col items-center justify-center" style={{ transform: 'translateZ(8px)' }}>
                                <span className="text-[9px] font-black text-white/90">{i + 1}</span>
                                {i === 2 && trapActive && (
                                    <div className="absolute inset-0 bg-red-600/30 border border-red-500 rounded-md animate-pulse flex items-center justify-center">
                                        <span className="text-[6px] font-black text-red-400">⚡ TRAP</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {step >= 2 && (
                        <motion.div
                            animate={{ 
                                left: miniCoords[tile - 1].x + 8,
                                top: miniCoords[tile - 1].y + 8,
                                z: 30
                            }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="absolute"
                            style={{ transformStyle: 'preserve-3d', zIndex: 100 }}
                        >
                            <div className="avatar-bubble" style={{ width: '32px', height: '32px', padding: '1px', transform: 'rotateZ(30deg) rotateX(-50deg)' }}>
                                <div className="avatar-img shadow-lg bg-pink-500 text-white text-[10px] font-bold">
                                    LR
                                </div>
                            </div>
                        </motion.div>
                    )}
            </InteractivePreview>

            <div className="w-full flex items-center justify-between gap-4">
                <div className="text-[9px] font-mono bg-background p-2.5 rounded-lg border border-border shadow-sm flex-1 min-h-[50px] flex flex-col justify-center text-foreground">
                    {step === 0 && <span className="text-slate-400">Press PLAY to view the trap strategy.</span>}
                    {step === 1 && <span className="text-yellow-400 font-bold">❯ Bobby sets IF-ELSE trap on Tile 3</span>}
                    {step === 2 && <span className="text-blue-400">❯ Lareina rolls & hops towards Tile 3...</span>}
                    {step === 3 && (
                        <div className="text-red-500 font-black flex flex-col gap-0.5">
                            <span>💥 Trap Triggered! Lands on Trap</span>
                            <span className="text-[8px] text-gray-400">HP: ❤️❤️❤️ ➔ ❤️❤️🖤 (-1 HP)</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    {step === 0 ? (
                        <button
                            onClick={runSimulation}
                            className="px-3.5 py-2.5 bg-[#81b64c] hover:bg-[#81b64c]/90 text-white font-black text-[10px] rounded-xl shadow-md flex items-center gap-1"
                        >
                            <Play className="w-3 h-3 fill-white" /> PLAY
                        </button>
                    ) : (
                        <button
                            onClick={resetSimulation}
                            disabled={isHopping}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-black text-[10px] rounded-xl shadow-md flex items-center gap-1"
                        >
                            <RotateCcw className="w-3 h-3" /> RESET
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Winning Preview: Bounce back mechanic
function WinningPreview({ playSfx }: { playSfx: any }) {
    const [tile, setTile] = useState(98);
    const [isHopping, setIsHopping] = useState(false);
    const [status, setStatus] = useState<'idle' | 'moving'>('idle');

    const miniCoords = [
        { x: 30, y: 55, num: 97 },
        { x: 95, y: 55, num: 98 },
        { x: 160, y: 55, num: 99 },
        { x: 225, y: 55, num: 100, finish: true },
    ];

    const runFinish = async () => {
        if (isHopping || status !== 'idle') return;
        setStatus('moving');
        playSfx('dice-roll');
        
        await new Promise(r => setTimeout(r, 600));
        playSfx('dice-land');
        await new Promise(r => setTimeout(r, 300));
        
        setIsHopping(true);
        
        const steps = [99, 100];
        for (let i = 0; i < steps.length; i++) {
            setTile(steps[i]);
            playSfx('hop');
            await new Promise(r => setTimeout(r, 450));
        }

        playSfx('success');
        setIsHopping(false);
        setStatus('idle');
    };

    return (
        <div className="flex flex-col items-center gap-4 p-5 bg-card/50 rounded-3xl border border-border shadow-inner w-full max-w-sm mx-auto">
            <p className="text-[11px] text-muted-foreground text-center font-medium max-w-xs">
                The first player to reach tile 100 (or beyond) wins! You don't need an exact roll.
            </p>

            <InteractivePreview defaultWidth={300} defaultHeight={130} defaultScale={0.95} containerHeight={150}>
                    {miniCoords.map((c, i) => {
                        const isFinish = c.finish;
                        const terrainClass = isFinish ? 'terrain-mud' : 'terrain-grass';
                        return (
                            <div 
                                key={i} 
                                className={`slab ${terrainClass}`}
                                style={{ left: `${c.x}px`, top: `${c.y}px`, width: '48px', height: '48px' }}
                            >
                                <div className="slab-side" style={{ height: '8px', bottom: '-4px' }}></div>
                                <div className={`slab-top ${terrainClass} flex flex-col items-center justify-center`} style={{ transform: 'translateZ(8px)' }}>
                                    <span className="text-[9px] font-black text-white/95">{isFinish ? 'FINISH' : c.num}</span>
                                </div>
                            </div>
                        );
                    })}

                    <motion.div
                        animate={{ 
                            left: miniCoords[tile - 97].x + 8,
                            top: miniCoords[tile - 97].y + 8,
                            z: 30
                        }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="absolute"
                        style={{ transformStyle: 'preserve-3d', zIndex: 100 }}
                    >
                        <div className="avatar-bubble" style={{ width: '32px', height: '32px', padding: '1px', transform: 'rotateZ(30deg) rotateX(-50deg)' }}>
                            <div className="avatar-img shadow-lg bg-[#81b64c] text-white text-[12px] font-bold">
                                P1
                            </div>
                        </div>
                    </motion.div>
            </InteractivePreview>

            <div className="flex items-center gap-4 w-full justify-between">
                <div className="text-[9px] font-mono bg-background p-2.5 rounded-lg border border-border shadow-sm flex-1 min-h-[50px] flex flex-col justify-center text-foreground">
                    {status === 'idle' ? (
                        <span className="text-slate-400">At Tile 98. Roll a 4 ➔ FINISH!</span>
                    ) : (
                        <span className="text-yellow-400 font-bold">98 ➔ 99 ➔ 100 (WINNER!)</span>
                    )}
                </div>

                <button
                    onClick={runFinish}
                    disabled={status !== 'idle'}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-[10px] rounded-xl shadow-md"
                >
                    🎲 ROLL 4
                </button>
            </div>
        </div>
    );
}

const sections = [
    {
        id: 'basics',
        title: 'The Basics',
        icon: <Dice5 className="w-6 h-6" />,
        content: `Algo Ladders is a turn-based multiplayer game where players race to tile 100. Instead of just rolling dice, players use programming concepts to navigate the board. Roll the dice to move, but use your logic to avoid traps and maximize your turns.`,
        preview: (playSfx: any) => <BasicsPreview playSfx={playSfx} />
    },
    {
        id: 'powers',
        title: 'Coding Powers',
        icon: <Zap className="w-6 h-6" />,
        content: `You have three unique programming powers each turn:
        • MATH (+, -, *, /): Alter the dice roll with mathematical operators based on the tile value.
        • FOR LOOP: Loop your movement multiple times. Great for covering large distances!
        • IF-ELSE: Build conditional logic to protect yourself from snakes and traps, or trigger special actions.`,
        preview: (playSfx: any) => <PowersPreview playSfx={playSfx} />
    },
    {
        id: 'hazards',
        title: 'Hazards & Board',
        icon: <ShieldAlert className="w-6 h-6" />,
        content: `Watch out for Snakes that send you backwards, and Traps that trigger negative effects like losing HP or losing a turn. Use Ladders to skip ahead. If your HP reaches 0, you are eliminated!`,
        preview: (playSfx: any) => <HazardsPreview playSfx={playSfx} />
    },
    {
        id: 'multiplayer',
        title: 'Multiplayer Strategy',
        icon: <Users className="w-6 h-6" />,
        content: `Pay attention to the turn order! Use IF-ELSE to set traps for other players or defend yourself when it's not your turn. Timing your FOR LOOPs when there are no hazards ahead is key.`,
        preview: (playSfx: any) => <MultiplayerPreview playSfx={playSfx} />
    },
    {
        id: 'winning',
        title: 'Winning the Game',
        icon: <Trophy className="w-6 h-6" />,
        content: `The first player to reach tile 100 (or beyond) wins! You don't need an exact roll. Alternatively, be the last player standing if everyone else loses their HP.`,
        preview: (playSfx: any) => <WinningPreview playSfx={playSfx} />
    }
];

export default function Guide() {
    const [activeSection, setActiveSection] = useState(sections[0].id);
    const [showSettings, setShowSettings] = useState(false);
    const { playSfx, playBgm, stopBgm, bgmVolume, setBgmVolume, sfxVolume, setSfxVolume } = useSoundEffects();

    // Play lobby BGM on mount and stop on unmount
    useEffect(() => {
        playBgm('lobby');
        return () => stopBgm();
    }, [playBgm, stopBgm]);

    return (
        <>
            <Head title="How to Play - Algo Ladders" />
            <div className="relative min-h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground p-6 md:p-12 flex flex-col justify-center">
                
                {/* Floating blur background circles matching Game Menu */}
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

                <div className="max-w-5xl mx-auto w-full z-10">
                    <div className="mb-6">
                        <Link 
                            href="/" 
                            onClick={() => playSfx('click')} 
                            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-semibold bg-card/85 p-3 rounded-full shadow-lg border border-border backdrop-blur-md"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="pr-2">Back to Title</span>
                        </Link>
                    </div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card/80 backdrop-blur-md rounded-3xl border border-border shadow-2xl overflow-hidden"
                    >
                        <div className="bg-primary/20 border-b border-border p-8">
                            <h1 className="text-4xl md:text-5xl font-black italic tracking-tight text-foreground uppercase">HOW TO PLAY</h1>
                            <p className="mt-2 text-md font-semibold text-muted-foreground">Master the logic, conquer the board.</p>
                        </div>
                        
                        <div className="flex flex-col md:flex-row">
                            {/* Sidebar Menu */}
                            <div className="md:w-1/3 bg-muted/10 border-r border-border p-6 flex flex-col gap-2.5">
                                {sections.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => { playSfx('click'); setActiveSection(s.id); }}
                                        className={`flex items-center gap-3 w-full text-left p-4 rounded-2xl font-bold transition-all border ${
                                            activeSection === s.id 
                                            ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-[1.02]' 
                                            : 'text-muted-foreground border-transparent hover:bg-card/50 hover:text-foreground'
                                        }`}
                                    >
                                        {s.icon}
                                        <span>{s.title}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Content Area */}
                            <div className="md:w-2/3 p-8 md:p-12 min-h-[460px] flex flex-col justify-center">
                                <AnimatePresence mode="wait">
                                    {sections.map(s => s.id === activeSection && (
                                        <motion.div
                                            key={s.id}
                                            initial={{ opacity: 0, x: 15 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -15 }}
                                            transition={{ duration: 0.25 }}
                                            className="grid lg:grid-cols-2 gap-8 items-center"
                                        >
                                            <div className="flex flex-col justify-center">
                                                <div className="flex items-center gap-3.5 mb-5 text-primary">
                                                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                                                        {s.icon}
                                                    </div>
                                                    <h2 className="text-2xl md:text-3xl font-black italic uppercase text-foreground">{s.title}</h2>
                                                </div>
                                                <p className="text-sm md:text-base leading-relaxed text-muted-foreground whitespace-pre-line font-medium">
                                                    {s.content}
                                                </p>
                                            </div>
                                            
                                            <div className="w-full flex justify-center items-center">
                                                {s.preview(playSfx)}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Settings Toggle Button */}
                <div className="fixed bottom-6 right-6 z-50">
                    <button 
                        onClick={() => { playSfx('click'); setShowSettings(true); }}
                        className="bg-card/85 backdrop-blur-md text-muted-foreground hover:text-foreground transition-colors p-3 rounded-full border border-border shadow-lg hover:shadow-xl"
                    >
                        <Volume2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Audio Volume Settings Modal */}
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

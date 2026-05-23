import { useEffect, useRef, useCallback, useState } from 'react';

type SfxCategory =
    | 'dice-roll'
    | 'dice-land'
    | 'trap-activate'
    | 'ladder-climb'
    | 'snake-slide'
    | 'success'
    | 'error'
    | 'click'
    | 'hop'
    | 'turn-start'
    | 'hp-loss'
    | 'power-select'
    | 'countdown'
    | 'stomp';

type BgmCategory = 'lobby' | 'game' | 'victory';

const sfxMap: Record<string, string[]> = {
    'dice-roll': [
        '/sounds/dice-roll/dice-roll (1).mp3',
        '/sounds/dice-roll/dice-roll (2).mp3',
        '/sounds/dice-roll/dice-roll (3).mp3',
        '/sounds/dice-roll/dice-roll (4).mp3',
        '/sounds/dice-roll/dice-roll.mp3',
    ],
    'dice-land': ['/sounds/dice-land.mp3'],
    'trap-activate': [
        '/sounds/trap-activate/trap-activate (1).mp3',
        '/sounds/trap-activate/trap-activate (2).mp3',
        '/sounds/trap-activate/trap-activate.mp3',
    ],
    'ladder-climb': ['/sounds/ladder-climb.mp3'],
    'snake-slide': ['/sounds/snake-slide.mp3'],
    'success': ['/sounds/victory.mp3'],
    'error': ['/sounds/elimination.mp3'],
    'click': ['/sounds/button-click.mp3'],
    'hop': ['/sounds/hop.mp3'],
    'turn-start': ['/sounds/turn-start.mp3'],
    'hp-loss': ['/sounds/hp-loss.mp3'],
    'power-select': ['/sounds/power-select.mp3'],
    'countdown': ['/sounds/countdown.mp3'],
    'stomp': ['/sounds/hp-loss.mp3'],
};

const bgmMap: Record<string, string[]> = {
    lobby: [
        '/sounds/BGM/bgm-lobby/AlgoLadder.mp3',
        '/sounds/BGM/bgm-lobby/Hide beneath the locker.mp3',
    ],
    game: [
        '/sounds/BGM/bgm-game/Serpent Snakes.mp3',
        '/sounds/BGM/bgm-game/Serpent Steps.mp3',
    ],
    victory: [
        '/sounds/BGM/bgm-victory/Logic Crusher.mp3',
        '/sounds/BGM/bgm-victory/Serpents hiding.mp3',
    ],
};

export function useSoundEffects() {
    const sfxCache = useRef<Record<string, HTMLAudioElement[]>>({});
    const currentBgm = useRef<HTMLAudioElement | null>(null);
    const currentBgmCategory = useRef<BgmCategory | null>(null);
    const currentBgmTrackIndex = useRef<number>(0);
    const pendingBgmCategory = useRef<BgmCategory | null>(null);

    const [bgmVolume, setBgmVolume] = useState(() =>
        parseFloat(localStorage.getItem('bgm_volume') || '0.2'),
    );
    const [sfxVolume, setSfxVolume] = useState(() =>
        parseFloat(localStorage.getItem('sfx_volume') || '0.5'),
    );

    useEffect(() => {
        if (currentBgm.current) {
            currentBgm.current.volume = bgmVolume;
        }
        localStorage.setItem('bgm_volume', bgmVolume.toString());
    }, [bgmVolume]);

    useEffect(() => {
        localStorage.setItem('sfx_volume', sfxVolume.toString());
    }, [sfxVolume]);

    // Preload audio files lazily with a pool for overlapping playback
    const getAudio = useCallback((path: string) => {
        if (!sfxCache.current[path]) {
            sfxCache.current[path] = [];
            for (let i = 0; i < 3; i++) {
                const audio = new Audio(path);
                sfxCache.current[path].push(audio);
            }
        }
        const pool = sfxCache.current[path];
        return pool.find((a) => a.paused) || pool[0];
    }, []);

    const playSfx = useCallback(
        (category: SfxCategory) => {
            const variants = sfxMap[category];
            if (!variants || variants.length === 0) return;

            const path = variants[Math.floor(Math.random() * variants.length)];

            try {
                const audio = getAudio(path);
                audio.volume = parseFloat(
                    localStorage.getItem('sfx_volume') || '0.5',
                );
                audio.currentTime = 0;
                audio.play().catch(() => {
                    // Silently ignore — browser may block before user interaction
                });
            } catch {
                // Ignore audio errors
            }
        },
        [getAudio],
    );

    // Play a BGM track and alternate to the next track when it ends
    const startBgmTrack = useCallback(
        (category: BgmCategory, trackIndex: number) => {
            const variants = bgmMap[category];
            if (!variants || variants.length === 0) return;

            // Don't play if we've switched to a different category
            if (pendingBgmCategory.current !== category) return;

            const idx = trackIndex % variants.length;
            const path = variants[idx];

            try {
                const audio = new Audio(path);
                audio.loop = false;
                audio.volume = parseFloat(
                    localStorage.getItem('bgm_volume') || '0.2',
                );

                audio.addEventListener('ended', () => {
                    // When a track ends, play the next one in the list
                    if (currentBgmCategory.current === category) {
                        const nextIndex = idx + 1;
                        currentBgmTrackIndex.current = nextIndex;
                        startBgmTrack(category, nextIndex);
                    }
                });

                const playPromise = audio.play();
                if (playPromise) {
                    playPromise.catch((e) => {
                        if (e.name === 'NotAllowedError') {
                            // Autoplay blocked — will retry on user interaction
                        }
                        // Silently ignore AbortError and other errors
                    });
                }

                currentBgm.current = audio;
                currentBgmCategory.current = category;
                currentBgmTrackIndex.current = idx;
            } catch {
                // Ignore audio errors
            }
        },
        [],
    );

    const playBgm = useCallback(
        (category: BgmCategory) => {
            pendingBgmCategory.current = category;

            // Don't restart if already playing the same category
            if (
                currentBgmCategory.current === category &&
                currentBgm.current &&
                !currentBgm.current.paused
            ) {
                return;
            }

            // Stop any currently playing BGM
            if (currentBgm.current) {
                currentBgm.current.pause();
                currentBgm.current = null;
            }

            // Start with a random track
            const variants = bgmMap[category];
            if (!variants || variants.length === 0) return;
            const startIdx = Math.floor(Math.random() * variants.length);
            startBgmTrack(category, startIdx);
        },
        [startBgmTrack],
    );

    const stopBgm = useCallback(() => {
        pendingBgmCategory.current = null;
        if (currentBgm.current) {
            currentBgm.current.pause();
            currentBgm.current = null;
        }
        currentBgmCategory.current = null;
    }, []);

    // Retry BGM playback on user interaction (browser autoplay policy)
    useEffect(() => {
        const retryBgm = () => {
            if (
                pendingBgmCategory.current &&
                (!currentBgm.current || currentBgm.current.paused)
            ) {
                const cat = pendingBgmCategory.current;
                const variants = bgmMap[cat];
                if (variants && variants.length > 0) {
                    const startIdx = Math.floor(
                        Math.random() * variants.length,
                    );
                    startBgmTrack(cat, startIdx);
                }
            }
            // Once BGM is actually playing, remove the listeners
            if (currentBgm.current && !currentBgm.current.paused) {
                cleanup();
            }
        };

        const cleanup = () => {
            document.removeEventListener('click', retryBgm);
            document.removeEventListener('keydown', retryBgm);
            document.removeEventListener('touchstart', retryBgm);
            document.removeEventListener('pointerdown', retryBgm);
        };

        document.addEventListener('click', retryBgm);
        document.addEventListener('keydown', retryBgm);
        document.addEventListener('touchstart', retryBgm);
        document.addEventListener('pointerdown', retryBgm);

        return cleanup;
    }, [startBgmTrack]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopBgm();
        };
    }, [stopBgm]);

    return {
        playSfx,
        playBgm,
        stopBgm,
        bgmVolume,
        setBgmVolume,
        sfxVolume,
        setSfxVolume,
    };
}

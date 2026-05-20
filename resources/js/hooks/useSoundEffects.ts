import { useEffect, useRef, useCallback, useState } from 'react';

type SfxCategory = 'dice-roll' | 'trap-activate' | 'ladder-climb' | 'snake-slide' | 'success' | 'error' | 'click' | 'hop' | 'turn-start';
type BgmCategory = 'lobby' | 'game' | 'victory';

const sfxMap: Record<string, string[]> = {
    'dice-roll': ['/sounds/dice-roll/dice-roll (1).mp3', '/sounds/dice-roll/dice-roll (2).mp3', '/sounds/dice-roll/dice-roll (3).mp3', '/sounds/dice-roll/dice-roll (4).mp3', '/sounds/dice-roll/dice-roll.mp3'],
    'trap-activate': ['/sounds/trap-activate/trap-activate (1).mp3', '/sounds/trap-activate/trap-activate (2).mp3', '/sounds/trap-activate/trap-activate.mp3'],
    'ladder-climb': ['/sounds/ladder-climb.mp3'],
    'snake-slide': ['/sounds/snake-slide.mp3'],
    'success': ['/sounds/victory.mp3'],
    'error': ['/sounds/elimination.mp3'],
    'click': ['/sounds/button-click.mp3'],
    'hop': ['/sounds/hop.mp3'],
    'turn-start': ['/sounds/turn-start.mp3']
};

const bgmMap: Record<string, string[]> = {
    'lobby': ['/sounds/BGM/bgm-lobby/AlgoLadder.mp3', '/sounds/BGM/bgm-lobby/Hide beneath the locker.mp3'],
    'game': ['/sounds/BGM/bgm-game/Serpent Snakes.mp3', '/sounds/BGM/bgm-game/Serpent Steps.mp3'],
    'victory': ['/sounds/BGM/bgm-victory/Logic Crusher.mp3', '/sounds/BGM/bgm-victory/Serpents hiding.mp3']
};

export function useSoundEffects() {
    const sfxCache = useRef<Record<string, HTMLAudioElement[]>>({});
    const currentBgm = useRef<HTMLAudioElement | null>(null);
    const [bgmVolume, setBgmVolume] = useState(() => parseFloat(localStorage.getItem('bgm_volume') || '0.2'));
    const [sfxVolume, setSfxVolume] = useState(() => parseFloat(localStorage.getItem('sfx_volume') || '0.5'));

    useEffect(() => {
        if (currentBgm.current) {
            currentBgm.current.volume = bgmVolume;
        }
        localStorage.setItem('bgm_volume', bgmVolume.toString());
    }, [bgmVolume]);

    useEffect(() => {
        localStorage.setItem('sfx_volume', sfxVolume.toString());
    }, [sfxVolume]);

    // Preload audio files lazily
    const getAudio = (path: string) => {
        if (!sfxCache.current[path]) {
            sfxCache.current[path] = [];
            for (let i = 0; i < 3; i++) {
                const audio = new Audio(path);
                sfxCache.current[path].push(audio);
            }
        }
        const pool = sfxCache.current[path];
        return pool.find(a => a.paused) || pool[0];
    };

    const playSfx = useCallback((category: SfxCategory) => {
        const variants = sfxMap[category];
        if (!variants || variants.length === 0) return;

        const path = variants[Math.floor(Math.random() * variants.length)];
        
        try {
            const audio = getAudio(path);
            audio.volume = parseFloat(localStorage.getItem('sfx_volume') || '0.5');
            audio.currentTime = 0;
            audio.play().catch(e => console.warn('SFX playback failed:', e));
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }, []);

    const playBgm = useCallback((category: BgmCategory) => {
        const variants = bgmMap[category];
        if (!variants || variants.length === 0) return;

        const path = variants[Math.floor(Math.random() * variants.length)];

        if (currentBgm.current) {
            currentBgm.current.pause();
            currentBgm.current.removeAttribute('src'); // Stop downloading
            currentBgm.current.load();
        }

        try {
            const audio = new Audio(path);
            audio.loop = true;
            audio.volume = parseFloat(localStorage.getItem('bgm_volume') || '0.2');
            audio.play().catch(e => console.warn('BGM playback failed:', e));
            currentBgm.current = audio;
        } catch (e) {
            console.error('Error playing BGM:', e);
        }
    }, []);

    const stopBgm = useCallback(() => {
        if (currentBgm.current) {
            currentBgm.current.pause();
            currentBgm.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            stopBgm();
        };
    }, [stopBgm]);

    return { playSfx, playBgm, stopBgm, bgmVolume, setBgmVolume, sfxVolume, setSfxVolume };
}

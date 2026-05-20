# Phase 6: Animations, Polish & How-To-Play Guide

Transform the game from functional to **premium** — inspired by **LINE Get Rich**, board game apps, and .io games. This phase focuses on juice, feedback, and player delight.

## Overview

| Sub-Phase | Focus | Files |
|-----------|-------|-------|
| 6A | Smooth Camera Pan | `game.tsx` |
| 6B | Dice Roll Animation | `game.tsx`, `app.css` |
| 6C | Player Movement (tile-by-tile hop) | `game.tsx`, `app.css` |
| 6D | In-Game Toast Notifications | New `GameToast.tsx` component, `game.tsx` |
| 6E | Turn Transition & UI Polish | `game.tsx`, `lobby.tsx`, `app.css` |
| 6F | How To Play Guide | New `guide.tsx` page, `welcome.tsx`, `web.php` |
| 6G | Sound Effects & Music | New `useSoundEffects.ts` hook, `game.tsx` |

---

## Proposed Changes

### 6A — Smooth Camera Pan

Currently the camera **snaps instantly** to the active tile. We'll add **spring-based easing** so it glides gracefully like a cinematic pan.

#### [MODIFY] [game.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/game.tsx)

- Replace `setPan()` snap with an **animated interpolation** using `requestAnimationFrame` + easing curve (or `framer-motion`'s `useSpring`)
- Change the map `transform` transition from `0.1s ease-out` → `0.6s cubic-bezier(0.25, 1, 0.5, 1)` for silky smooth movement
- Add slight **zoom pulse** when the camera arrives at a tile (scale 1.0 → 1.02 → 1.0)

---

### 6B — Dice Roll Animation

Instead of the result appearing instantly, show a **3D dice rolling animation** (LINE Get Rich style).

#### [MODIFY] [game.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/game.tsx)

- When the player clicks "ROLL DICE", show a **full-screen animated dice** overlay
- The dice tumbles/spins for ~1.5s, then lands on the result number
- Use CSS 3D transforms (`rotateX`, `rotateY`) with keyframe animations for the tumble
- After the dice settles, auto-dismiss the overlay and proceed to the action phase

#### [MODIFY] [app.css](file:///d:/laragon/www/algoladders/resources/css/app.css)

- Add `@keyframes dice-tumble` with 3D rotation stages
- Style the 3D dice cube faces

---

### 6C — Player Movement (Tile-by-Tile Hop)

Currently avatars teleport to the final position. We'll make them **hop tile-by-tile** along the path, like a board game piece.

#### [MODIFY] [game.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/game.tsx)

- When `gameState` updates with a new player position, compute the **path** from old position to new position (tile by tile)
- Animate the avatar hopping through each intermediate tile with a ~200ms delay per tile
- Add a **squash & stretch** effect on each hop landing (scale Y compress + bounce)
- When landing on a snake head or ladder bottom, play a special **slide/climb animation** with a brief pause
- Camera follows the moving player smoothly during the hop sequence

---

### 6D — In-Game Toast Notifications

Slide-in/out contextual popups like LINE Get Rich's event banners.

#### [NEW] [GameToast.tsx](file:///d:/laragon/www/algoladders/resources/js/components/GameToast.tsx)

A reusable toast component with variants:
- **⚠️ Warning** (orange): "Bobby activated IF-ELSE trap! Watch out!"
- **🎯 Info** (blue): "It's your turn! Select a power-up."
- **🐍 Danger** (red): "Lareina landed on a snake! Sliding down..."
- **🪜 Success** (green): "You found a ladder! Climbing up!"
- **🏆 Victory** (gold): "Bobby crossed the finish line in 1st place!"
- **💀 Elimination** (grey): "Lareina was eliminated!"

Each toast:
- Slides in from the right side with a spring animation
- Shows for 3 seconds
- Has an icon, bold title, and description
- Can stack multiple toasts with vertical offset
- Auto-dismisses with a smooth slide-out

#### [MODIFY] [game.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/game.tsx)

- Parse game log changes to auto-trigger toasts
- Show toasts for: turn changes, snake/ladder hits, power-up usage, trap activation, elimination, victory

---

### 6E — Turn Transition & UI Polish

#### [MODIFY] [game.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/game.tsx)

- **Turn banner**: When the turn switches, show a brief full-width banner "BOBBY'S TURN" (with their color) that slides down and fades out after 1.5s
- **Phase indicators**: Animate the bottom panel transitions between select → roll → action phases with slide/fade
- **Power-up selection glow**: Add particle/glow effects when a power-up is selected
- **HP change animation**: Hearts should bounce/pulse when HP changes; death animation when HP hits 0

#### [MODIFY] [lobby.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/lobby.tsx)

- **Ready pulse**: When a player readies up, their card pulses with a green glow ring
- **Join animation**: New players joining get a celebration micro-animation (confetti burst)
- **Countdown upgrade**: The 3-2-1 countdown gets scaling text + screen shake + color shifts

#### [MODIFY] [app.css](file:///d:/laragon/www/algoladders/resources/css/app.css)

- Add keyframe animations for glow, pulse, shake effects
- Add particle/sparkle CSS animations for power-up selections

---

### 6F — How To Play Guide

A rich, visual guide page accessible from the welcome screen's "HOW TO PLAY" button.

#### [NEW] [guide.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/guide.tsx)

A step-by-step interactive guide with sections:

1. **Overview** — What is Algo Ladders? (brief intro with hero image)
2. **Game Setup** — Creating/joining rooms, ready system
3. **Turn Flow** — Select Power → Roll Dice → Execute Action (with animated diagrams)
4. **Power-Ups Explained** — MATH, IF-ELSE, FOR LOOP (with visual examples)
5. **Snakes & Ladders** — How they work, the IF-ELSE trap mechanic
6. **Winning** — How HP, elimination, and victory work

Each section will use:
- Screenshots captured from actual gameplay (using the `generate_image` tool to create illustrative mockups)
- Smooth scroll-triggered animations as sections enter viewport
- Interactive mini-demos where possible (e.g., a demo dice roll)

#### [MODIFY] [welcome.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/welcome.tsx)

- Wire the "HOW TO PLAY" button (currently a no-op `<button>`) to navigate to `/guide`

#### [MODIFY] [web.php](file:///d:/laragon/www/algoladders/routes/web.php)

- Add `Route::inertia('/guide', 'guide')->name('guide')` (public, no auth required)

---

### 6G — Sound Effects & Music

#### [NEW] [useSoundEffects.ts](file:///d:/laragon/www/algoladders/resources/js/hooks/useSoundEffects.ts)

A React hook that provides a `play(soundName)` function:
- Preloads all audio files on mount
- Handles volume control and muting
- Uses `HTMLAudioElement` pool to allow overlapping sounds

#### [MODIFY] [game.tsx](file:///d:/laragon/www/algoladders/resources/js/pages/game.tsx)

- Integrate sound triggers for all game events

---

## Sound & Music Asset List

> [!IMPORTANT]
> Please provide the following audio files. Place them in `public/sounds/`. Format: `.mp3` or `.ogg` (short clips, <500KB each).

### Sound Effects (SFX)

| Sound | When It Plays | Suggestion |
|-------|---------------|------------|
| `dice-roll.mp3` | Player clicks "Roll Dice" | Rattling dice on wood table |
| `dice-land.mp3` | Dice result appears | Solid thud/click |
| `hop.mp3` | Player hops to each tile | Light bounce/pop |
| `snake-slide.mp3` | Player hits a snake | Downward slide/whoosh |
| `ladder-climb.mp3` | Player hits a ladder | Upward chime/ascending notes |
| `power-select.mp3` | Power-up button clicked | Magical sparkle/confirm |
| `trap-activate.mp3` | IF-ELSE trap triggers | Warning alarm/zap |
| `turn-start.mp3` | "Your Turn" banner appears | Short notification chime |
| `hp-loss.mp3` | Player loses a heart | Painful hit/crunch |
| `elimination.mp3` | Player eliminated | Dark dramatic sting |
| `victory.mp3` | Game winner declared | Triumphant fanfare |
| `button-click.mp3` | Any UI button press | Soft click/tap |
| `countdown.mp3` | Lobby countdown 3-2-1 | Beep...beep...BEEP |
| `game-start.mp3` | Game begins | Epic intro swoosh |

### Background Music

| Track | Where | Suggestion |
|-------|-------|------------|
| `bgm-lobby.mp3` | Lobby waiting screen | Chill, upbeat lo-fi or jazzy loop |
| `bgm-game.mp3` | During gameplay | Adventurous, light tension, board-game feel |
| `bgm-victory.mp3` | Victory screen | Celebratory, triumphant |

> [!TIP]
> Free sources: [Pixabay](https://pixabay.com/music/), [Freesound](https://freesound.org/), [Mixkit](https://mixkit.co/free-sound-effects/). Look for "board game", "dice", "cartoon" categories.

---

## Open Questions

1. **Turn order reveal animation**: You mentioned wanting this for Phase 6. Should this be a short animation at game start showing each player's avatar in their turn order (like a card flip reveal)?

2. **Guide page**: Should the guide be accessible without logging in (public)? I've assumed yes since it helps onboard new players.

3. **Mobile**: Should toasts/dice animations scale down for mobile, or is mobile UI a separate phase?

---

## Verification Plan

### Visual Testing
- Play a full 2-player game end-to-end, verifying each animation fires at the correct moment
- Test camera panning feels smooth (no jank or snap)
- Verify toasts don't overlap awkwardly with the bottom control panel
- Confirm guide page renders correctly and "HOW TO PLAY" button works

### Performance
- Ensure animations don't cause frame drops on mid-range hardware
- Verify audio preloading doesn't block page load

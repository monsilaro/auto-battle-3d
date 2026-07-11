# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Gravemarch** — single-player dark-fantasy 3D auto-battler (browser, no game engine). Player builds a settlement on a hex grid; buildings field a warband; each round the warband auto-fights an escalating undead wave. 10 rounds, must win every round, round 10 is a boss. Inspired by Northgard Battlegrounds. Design/milestone plan: `C:\Users\monsi\.claude\plans\okay-make-a-good-lively-widget.md`.

## Commands

```
npm run dev        # Vite dev server (game at localhost:5173)
npm run test       # vitest run (all suites, headless — no browser needed)
npx vitest run tests/battle.test.ts        # single suite
npx vitest run -t "determinism"            # by test name
npm run balance    # headless balance sweep (200 seeds × 4 strategies); -- --seeds 500 for more
npm run build      # tsc --noEmit && vite build
npx tsx scripts/inspect-glb.ts <file.glb>  # list animation clips/meshes in a GLB
```

## Architecture — the one rule that matters

One-way dependency: `data` ← `sim` ← (`render`, `ui`, `audio`, `app`).

`src/sim` and `src/data` are **pure, deterministic TypeScript**: no three.js, no DOM, no `Math.random`/`Date.now`/`performance.now`, no transcendental Math (`sin/cos/atan2/pow/exp` — `sqrt` is allowed; direction tables are hardcoded literals, see `DIR16` in `movement.ts`). Enforced by regex in `tests/architecture.test.ts` — it will fail your build if you slip. RNG is one explicit mulberry32 stream (`sim/rng.ts`) stored in `BattleState.rngState`. State fingerprints via cyrb53 (`sim/hash.ts`).

Render/UI mutate the sim **only** through the command API in `src/sim/run.ts` (`placeBuilding`, `sellBuilding`, `buyBlessing`, `startBattle`, `tickBattle`, `activateBlessing`, `finishBattle`). They read state freely and drain `battle.events` (`SimEvent[]`, rebuilt each tick).

### Sim ↔ render time
20 Hz fixed tick (`TICK_MS`), accumulator loop in `app/gameLoop.ts`. Sim writes `prevX/prevZ` at tick start; render lerps prev→curr with the accumulator alpha. **Animations are cosmetic** — driven by sim events (`attack`/`ability`/`death`/`summon`) in `render/battleView.ts`, never gating the sim. 2x speed = faster accumulation, identical tick sequence.

### Spatial coupling (do not hardcode offsets)
Hex village layout lives in the **sim** (`village.ts`: flat-top axial, radius 3 = 37 cells, `hexToLocal`, `cellBattlePos`) using constants from `data/balance.ts` (`HEX_WORLD_SIZE`, `VILLAGE_BATTLE_ORIGIN`, field dims). Player units spawn at their source building's cell (battle-space) and march east; enemies deploy in rows on the east edge. `render/coords.ts` **derives** world positions from the same constants — sim spawns and rendered buildings align by construction.

### Battle resolution (`sim/battle/`)
Per tick, in order: queued actives → targeting → movement (+separation) → attacks (+cleave) → abilities → death sweep → end check. All loops iterate `units[]` in id order; dead units get `alive = false`, never spliced. Anti-clump systems: crowd-penalized targeting (`targeting.ts`), 16-direction surround slots for melee (`movement.ts`), same-team separation padding. Battle timeout 1800 ticks = defeat.

## Balance workflow

All tuning numbers live in `src/data/` (units, buildings, blessings, waves, balance). To rebalance: edit data → `npm run balance` → compare against targets: **balanced ~98% run win** (R9 is the designed wall), **all-melee ~80%**, **economy-first ~25%**, **poor-build 0% (dies R3)**; final-round survivors 30–70%. Scripted strategies live in `scripts/strategies.ts` (shared by the sweep and `tests/progression.test.ts`, which is the coarse regression net — update its thresholds only deliberately). Any change to sim mechanics shifts balance: always re-sweep.

## Assets

CC0 only (KayKit packs, from GitHub). **Every shipped file needs a row in `ASSETS.md`.** Characters share one ~95-clip animation library — clip names in `render/unitVisuals.ts` (which maps sim defIds → model/scale/tint/clips); buildings map in `render/villageView.ts` (`BUILDING_MODELS`). Sim def `model` fields are unused — visual mapping is render-layer only. UI icons are not files: `render/iconFactory.ts` renders each model to a data-URL at boot.

## UI

No framework. `ui/dom.ts` has `el()` + `signal()`; screens are overlay divs (`ui/screens.ts`). Tooltips: elements opt in with `data-tip="<key>"` (`b:<id>` buildings, `u:<id>` units, `bl:<id>` blessings), content builders registered in `ui/tips.ts`, stat text generated in `ui/format.ts`. Health bars / building badges are pooled DOM divs projected per frame (`render/healthBars.ts`). Display font is self-hosted Cinzel (OFL).

## Post / FX / Audio

- Post stack in `render/post.ts` (pmndrs `postprocessing` + `n8ao`; type shim in `src/types/n8ao.d.ts`): Render → N8AO (half-res) → Bloom → hue/contrast grade + vignette + SMAA. Grading uses effects, not a LUT file.
- Environment shaders are `onBeforeCompile` injections sharing one time uniform (`environment.ts`): island radial color grade, ocean swell + bands, tree wind sway. `env.update(dt)` advances the clock.
- Particles: `render/fx/particles.ts` — CPU-updated `ParticleSystem` with a custom point shader (per-particle size/color/life). Ambient ash + lantern embers run always; hit/death/blessing bursts are fired from sim events in `main.ts`'s `onTick`.
- Audio is 100% procedural WebAudio (`src/audio/audio.ts`) — no files, nothing to license. `audio.unlock()` must be called from a user gesture; per-sound rate limiting built in; mute persists via localStorage.
- Debug keys: `` ` `` perf overlay (fps/draw calls/tris/units), `P` toggle post stack, `M` mute, `Esc` cancel placement.

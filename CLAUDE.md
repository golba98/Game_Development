# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

**Recommended (Docker):**
```bash
docker build -t forest-rpg .
docker run -p 3000:3000 forest-rpg
# Open http://localhost:3000/menu.html
docker stop $(docker ps -q)  # to stop
```

**Node.js server (save/load support):**
```bash
node scripts/map_server.js
# Open http://localhost:3000
```

**Quick play (no save/load):** Open `game.html` via VS Code Live Server extension.

## Architecture

This is a browser-based 2D top-down RPG built with **p5.js**. No build step — plain JS files loaded via `<script>` tags.

### File Layout

| File | Role |
|---|---|
| `menu.html` | Menu entry point — loads `src/menu/*.js` |
| `game.html` | Game entry point — loads `src/game/*.js` |
| `src/shared/shared-constants.js` | `DEFAULT_SETTINGS`, `SETTINGS_CATEGORIES` — shared by menu + game |
| `src/game/game-globals.js` | All game globals, constants, `GameGroups`, `AssetTracker`, `TILE_TYPES` |
| `src/game/game-assets.js` | `preload()`, image/graphics creation, `trackLoadImage/Sound` |
| `src/game/runtime/perf-overlay.js` | `PerfOverlay`: dev-only FPS/frame/update/render/drawImage/entity instrumentation (`?debug=1`) |
| `src/game/runtime/game-loop.js` | `GameLoop`: delta clamp + fixed-step accumulator (spiral-of-death guard) |
| `src/game/runtime/input-state.js` | `InputState`: centralized key state (down/pressed/released), event-driven |
| `src/game/runtime/scene-manager.js` | `SceneManager`: read-only state façade (LOADING/MAPGEN/PLAYING/PAUSED/GAME_OVER) |
| `src/game/runtime/renderer.js` | `Renderer`: world entity pass (`drawWorld`) + night/lighting pass (`drawNightOverlay`) |
| `src/game/runtime/hud-cache.js` | `HudCache`: bakes static HUD content (minimap tree markers) into offscreen buffers |
| `src/game/runtime/asset-cache.js` | `AssetCache`: per-size prescaled sprite cache + missing-asset guard |
| `src/game/game-weather.js` | `WeatherSystem` singleton: day/night cycle + dynamic lighting overlay |
| `src/menu/menu-globals.js` | Menu global variables |
| `src/menu/menu-core.js` | `preload()`, `setup()`, `draw()` for menu |
| `src/menu/menu-settings.js` | Settings overlay UI |
| `src/menu/menu-audio.js` | Audio management |
| `src/menu/menu-video.js` | Video background |
| `src/menu/menu-zoom.js` | Zoom handling |
| `src/menu/menu-ui.js` | UI components |
| `src/menu/menu-io.js` | Local storage I/O |
| `src/menu/menu-terminal.js` | Debug terminal |
| `scripts/map_server.js` | Node.js HTTP server; serves static files + `/maps/` read/write API |
| `maps/` | JSON world saves (`active_map.json` = currently loaded world) |
| `assets/` | Sprites, audio, GUI textures |

**Load order matters**: `src/shared/shared-constants.js` → `src/game/game-globals.js` → `src/game/runtime/*.js` (the layers below) → `src/game/game-assets.js` → ... → `src/game/game-weather.js` → `src/game/game-core.js`. No duplicate declarations across these files.

### Runtime Layers (`src/game/runtime/`)

`game-core.js`'s `draw()` is an orchestrator that calls thin, single-responsibility layers instead of inlining everything. Each is a plain global singleton object (same pattern as `GameGroups`), loaded before `game-core.js`:

- **Loop/pacing** — `GameLoop.clampDelta()` produces `gameDelta` (clamped to 50ms = the spiral-of-death guard); FPS is the `targetFps` setting (Graphics → Max FPS, default **60**), applied via `applyFPS()`.
- **Input** — `InputState` latches key state from window key events (capture phase), so taps register even between frames at low FPS. `handleMovement()` reads `InputState.isDown()`.
- **Scenes** — `SceneManager.isSimulating()/isOverlayOpen()/current()` derive the runtime state from the existing flags; gameplay/weather updates run only when `isSimulating()`.
- **Render** — `Renderer.drawWorld()` builds the depth-sorted, viewport-culled drawable pool and draws entities; `Renderer.drawNightOverlay(camX,camY)` does ambient particles + the day/night lighting overlay. The static map is a single cached `mapImage` blit; HUD is `game-hud.js`.
- **Assets** — `AssetCache.prescaled(img,w,h)` (aliased by `getPrescaledImage`) caches each sprite at its draw size; failed builds cache the source so they aren't retried per frame.
- **HUD cache** — `HudCache.bakeMinimapStatics()` bakes static minimap markers into `minimapImage` at map-build time.
- **Perf** — `PerfOverlay` (enable with `?debug=1` or `?renderstats=1`) shows FPS/frame/update/render times, drawImage count, and entities rendered/culled. **Off in production** unless explicitly enabled.

### Key Design Patterns

- **`GameGroups` object** (in `src/game/game-globals.js`): A namespace registry that wraps every major function by category (`Core`, `Map`, `Rivers`, `Movement`, `IO`, `Assets`, `Audio`).
- **Map generation pipeline**: `generateMap` → `generateMap_Part1` (Perlin noise terrain, river carving via "drunken walk") → `generateMap_Part2` (cellular automata hills, flood-fill connectivity check).
- **`ALLOW_ACTIVE_MAP_FETCH`** (in `game-globals.js`): Feature flag — set `false` to skip server map fetch on load. `VERBOSE_LOGGING_ENABLED` controls debug logs.
- **`DEFAULT_SETTINGS`** is defined in `src/shared/shared-constants.js` only — no longer duplicated.
- **Canvas patching** (in `game-globals.js`): `getContext('2d')` is monkey-patched globally to always pass `willReadFrequently: true` for performance.
- **`WeatherSystem`** (`src/game/game-weather.js`): Day/night cycle is 120s. `drawOverlay(w, h, lights)` takes screen-space light sources `{x, y, radius, r, g, b, intensity}`.

### Controls (in-game)
- `W/A/S/D` — move, `Shift` — sprint, `Esc` — pause, `P` — regenerate map, `T` — toggle sprite assets, `Space` — jump (experimental)

### Map Persistence
- Maps serialize to JSON with `mapStates`, `terrainLayer`, `treeObjects`, dimensions, and a `persistentGameId`.
- The server writes to `maps/active_map.json`; the client fetches it on load when `ALLOW_ACTIVE_MAP_FETCH = true`.

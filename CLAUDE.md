# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

**Recommended (Docker):**
```bash
docker build -t forest-rpg .
docker run -p 3000:3000 forest-rpg
# Open http://localhost:3000/1-Menu_Index.html
docker stop $(docker ps -q)  # to stop
```

**Node.js server (save/load support):**
```bash
node scripts/map_server.js
# Open http://localhost:3000
```

**Quick play (no save/load):** Open `3-Game_Index.html` via VS Code Live Server extension.

## Architecture

This is a browser-based 2D top-down RPG built with **p5.js**. No build step — plain JS files loaded via `<script>` tags.

### File Layout

| File | Role |
|---|---|
| `1-Menu_Index.html` | Menu entry point — loads `src/menu/*.js` |
| `3-Game_Index.html` | Game entry point — loads `src/game/*.js` |
| `src/shared/shared-constants.js` | `DEFAULT_SETTINGS`, `SETTINGS_CATEGORIES` — shared by menu + game |
| `src/game/game-globals.js` | All game globals, constants, `GameGroups`, `AssetTracker`, `TILE_TYPES` |
| `src/game/game-assets.js` | `preload()`, image/graphics creation, `trackLoadImage/Sound` |
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

**Load order matters**: `src/shared/shared-constants.js` → `src/game/game-globals.js` → `src/game/game-assets.js` → ... → `src/game/game-weather.js` → `src/game/game-core.js`. No duplicate declarations across these files.

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

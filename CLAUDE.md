# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

**Recommended (Docker):**
```bash
docker build -f Dockerfile.txt -t forest-rpg .
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
| `1-Menu_Index.html` | Menu entry point |
| `2-Menu.js` | Menu UI, settings, video background, audio |
| `3-Game_Index.html` | Game entry point; adopts p5 canvas into `#game-root` |
| `4-Game.js` | Core game: all logic, rendering, map gen, HUD, enemies, combat |
| `5-Weather.js` | `WeatherSystem` singleton: day/night cycle + dynamic lighting overlay |
| `scripts/map_server.js` | Node.js HTTP server; serves static files + `/maps/` read/write API |
| `maps/` | JSON world saves (`active_map.json` = currently loaded world) |
| `assets/` | Sprites, audio, GUI textures |

### Key Design Patterns in `4-Game.js`

- **`GameGroups` object** (line ~114): A namespace registry that wraps every major function by category (`Core`, `Map`, `Rivers`, `Movement`, `IO`, `Assets`, `Audio`). Functions are still defined globally but referenced here for discoverability.
- **Map generation pipeline**: `generateMap` → `generateMap_Part1` (Perlin noise terrain, river carving via "drunken walk") → `generateMap_Part2` (cellular automata hills, flood-fill connectivity check).
- **`ALLOW_ACTIVE_MAP_FETCH`** (line ~103): Feature flag — set `false` to skip server map fetch on load. `VERBOSE_LOGGING_ENABLED` controls debug logs.
- **`DEFAULT_SETTINGS`** is defined in both `2-Menu.js` and `4-Game.js` — they must stay in sync.
- **Canvas patching** (line ~36): `getContext('2d')` is monkey-patched globally to always pass `willReadFrequently: true` for performance.
- **`WeatherSystem`** (`5-Weather.js`): Day/night cycle is 120s. `drawOverlay(w, h, lights)` takes screen-space light sources `{x, y, radius, r, g, b, intensity}`.

### Controls (in-game)
- `W/A/S/D` — move, `Shift` — sprint, `Esc` — pause, `P` — regenerate map, `T` — toggle sprite assets, `Space` — jump (experimental)

### Map Persistence
- Maps serialize to JSON with `mapStates`, `terrainLayer`, `treeObjects`, dimensions, and a `persistentGameId`.
- The server writes to `maps/active_map.json`; the client fetches it on load when `ALLOW_ACTIVE_MAP_FETCH = true`.

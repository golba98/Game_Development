# Top-Down Procedural RPG Engine Technical Documentation

## System overview

This project is a browser-based procedural RPG implemented as ordered JavaScript globals over p5.js, p5.sound, and an optional PixiJS rendering backend. It has two browser applications: a menu/settings shell and the game runtime. A local Node HTTP server can persist the active generated map; Cloudflare deployment is intentionally static and therefore runs without map writes. The project uses no bundler, so HTML script order is the dependency graph.

```mermaid
flowchart TD
  Index[index.html] --> Menu[menu.html]
  Menu --> MenuModules[src/menu globals/modules]
  Menu --> GameFrame[game.html overlay/iframe]
  GameFrame --> Shared[src/shared]
  GameFrame --> Globals[game-globals.js]
  Globals --> Runtime[src/game/runtime]
  Runtime --> Domains[src/game/game-*.js]
  Domains --> Core[game-core.js p5 lifecycle]
  Core --> P5[p5 canvas/input/audio]
  Core --> Pixi[optional Pixi render layers]
  Core --> MapAPI[local map server]
  MapAPI --> Map[(maps/active_map.json)]
```

## Browser runtime architecture

`index.html` redirects to `menu.html`, which loads shared constants/UI before menu globals and focused audio, I/O, video, zoom, UI, terminal, settings, and core modules. The menu launches the game as a full-screen overlay/iframe and exchanges lifecycle messages with `game.html`. Settings stored by the menu are read by the game runtime.

`game.html` loads Pixi and p5 first, then shared/global modules, runtime infrastructure, Pixi adapters, domain modules, and finally `game-core.js`. `game-core.js` implements p5's preload/setup/draw lifecycle and orchestrates update/render stages. Because modules publish browser globals, moving a script before its dependencies causes runtime `ReferenceError`s even when each file passes syntax validation.

Domain files separate assets, terrain/map generation, enemies, movement, HUD, menus, settings, I/O, terminal commands, tutorials, world rules, utilities, and weather. Runtime files centralize input state, frame timing, scene selection, render delegation, caches, performance overlay, and Pixi renderers. Shared modules contain menu/game contracts.

## Simulation and rendering flow

The procedural world uses seeded/noise-driven terrain and object placement, river carving, hill smoothing, connectivity checks, enemies, pickups, weather, and day/night state. Input updates player intent; the frame loop clamps delta time and optionally consumes a bounded number of fixed simulation steps so tab suspension or slow frames do not teleport entities or create an unbounded catch-up spiral.

p5 owns the animation callback, gameplay simulation, input, audio, and a UI canvas. The selected render backend is persisted in localStorage. In p5 mode, the normal canvas renders the scene. In Pixi mode, Pixi owns WebGL world/entity/weather/minimap layers and p5 remains a transparent HUD/input overlay. Renderer modules and asset/HUD caches prevent domain code from duplicating backend-specific drawing and expensive per-frame lookups.

Scene and loading overlays control the menu, gameplay, pause, settings, tutorial, failure, and transition states. Performance instrumentation records update/world/entity/weather/HUD/minimap and Pixi flush timing only when the diagnostics overlay is active.

## Persistence and local server

`scripts/map_server.js` serves the repository's permitted static game files and three map operations. `GET /maps/active_map.json` returns the active map or creates a default. `POST /save-map` optionally requires `X-Map-Key`, bounds input to 5 MiB, parses JSON, and replaces the active file. `GET /maps` lists saved map files. Path normalization and a forbidden-path list prevent the static handler from exposing repository metadata and scripts.

Configuration is `PORT`, `MAP_SERVER_KEY`, and `ALLOWED_ORIGIN`. An empty key disables write authentication and wildcard origin allows any browser, so both must be set for a network-accessible server. The active-map write is synchronous and replacement is not transactional; this is a local single-writer design rather than a multi-user save service.

Cloudflare uses `scripts/build-static.mjs` to recreate `dist/` from an explicit allowlist of HTML, assets, source, and maps, rejecting individual assets above 25 MiB. `wrangler.jsonc` deploys that static directory. No Worker endpoint is shipped, so save/load writes are disabled in the hosted version by design.

## Security, reliability, and accessibility

Do not expose the local map server with wildcard CORS or an unset key. Map payloads should be schema/size validated before game use, and error text should not expose host paths. CDN libraries are runtime dependencies; vendor copies exist for p5, but production behavior should deliberately select CDN versus local assets and use integrity/pinning where possible.

Audio must recover from browser autoplay suspension after user interaction. Loading overlays have failure escape paths. Delta clamping, asset fallbacks, scene ownership, and cache resets protect runtime recovery. Keyboard-only controls, focus restoration after overlays, text sizing, mute controls, reduced motion, contrast, and alternatives for canvas-only instructions are the primary accessibility concerns.

## Development, testing, and extension

Use `npm run build` to validate/create static output and `npm run deploy` for Cloudflare. Use `node scripts/map_server.js` for full local map persistence. There is no formal test runner; run `node --check` over JavaScript, build the static allowlist, and smoke menu-to-game launch, both render backends, resize/zoom, pause/settings, save/load, regeneration, audio, terminal commands, and failure fallbacks.

Add simulation behavior to the owning domain file, backend drawing through renderer adapters, and shared menu/game constants in `src/shared`. Preserve HTML load order and global contracts. A future module/bundler migration must first define explicit imports and a compatibility layer rather than mechanically reordering files.

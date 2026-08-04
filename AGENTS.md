# Repository Guidelines

## Project Structure & Module Organization

This browser-based RPG has a menu (`menu.html`) and gameplay (`game.html`);
`index.html` redirects to the menu. `src/menu/` holds menu/settings modules,
`src/game/` holds gameplay domains, `src/game/runtime/` owns rendering, input,
scenes, and Pixi adapters, and `src/shared/` holds cross-app contracts. Assets
are in `assets/`, persisted local worlds in `maps/`, and tooling in `scripts/`.

The app does not use a bundler: HTML `<script>` order is its dependency graph.
Files publish browser globals, so load dependencies first. Keep
rendering-backend details in `runtime/`, not gameplay modules.

## Build, Test, and Development Commands

- `npm install` installs Wrangler and Pixi dependencies.
- `npm run build` recreates deployable static files in `dist/`.
- `npm run dev` builds and starts the Cloudflare-compatible static site.
- `node scripts/map_server.js` runs the local server with map save/load support
  (normally at `http://localhost:3000`).
- `npm run deploy` builds and deploys static assets through Wrangler.

## Coding Style & Naming Conventions

Write JavaScript with two-space indentation, semicolons, and existing
`camelCase` identifiers. Keep one focused concern per file: `game-*.js` for game domains,
`menu-*.js` for menu features, and `pixi-*-renderer.js` for Pixi adapters.
Prefer existing shared constants over new magic numbers. No formatter or linter
is configured; match nearby code and use
`node --check path/to/file.js` after edits.

## Testing Guidelines

There is no automated test suite. Run `npm run build`, syntax-check changed
JavaScript, then smoke-test launch, pause/settings, resize/zoom, input, and
the affected renderer. For map changes, test regeneration and save/load with
the local server; static deployments intentionally cannot save maps.

## Commit & Pull Request Guidelines

Use concise imperative Conventional Commit-style subjects, such as
`fix: prevent duplicate texture uploads` or `style: improve HUD spacing`.
Keep commits scoped. PRs should explain player-visible impact, list validation,
link relevant issues, and include screenshots or a short recording for UI,
rendering, or gameplay changes. Do not commit `.env*`, `dist/`, or generated
local maps unless deliberately included.

## Configuration & Security

For a network-accessible local map server, set `MAP_SERVER_KEY` and
`ALLOWED_ORIGIN`; an empty key and wildcard origin are intended only for local
development. Treat saved maps as untrusted input and retain server size and
path restrictions.

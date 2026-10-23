# Forest RPG

A 2D top-down procedural RPG engine built from scratch with JavaScript and
p5.js. Every play session generates an organic world — forests, rivers, hills
and varied terrain — from a seed, and a local Node.js server persists the
worlds you create, edit, save and reload.

- **Version:** 1.0.0
- **Author:** Jordan Vorster
- **Engine:** Custom JavaScript / p5.js

## Overview

The engine is split into a menu and a game runtime (see
[Directory structure](#directory-structure)). Procedural generation runs on
the client; a small Node.js map server handles world persistence.

## Installation and setup

Save/load requires a local Node.js server. Pick one of the methods below.

### Method 1: Local Node server

1. Install Node.js 22 or newer from <https://nodejs.org/>.
2. Open a terminal in the project root.
3. (Optional) `npm install` to install the tooling dependencies.
4. Start the server:

   ```bash
   node scripts/map_server.js
   # Map & static server listening on http://localhost:3000
   ```

5. Open <http://localhost:3000> in your browser; the game loads and fetches
   the active map automatically.

### Method 2: Quick play (VS Code Live Server)

Good for quick testing. Map saving falls back to temporary storage.

1. Open the project folder in VS Code and install the "Live Server" extension
   (Ritwick Dey).
2. Right-click `game.html` and choose "Open with Live Server".

### Method 3: Docker container

Ensures a consistent environment isolated from your local machine.

1. Install Docker Desktop (<https://www.docker.com/products/docker-desktop/>)
   and sign in once installed. On Windows, Docker Desktop may ask for a
   restart to enable its Linux backend.
2. From the project root (where the `Dockerfile` lives), build and run:

   ```bash
   docker build -t forest-rpg .
   docker run -p 3000:3000 forest-rpg
   ```

3. Open <http://localhost:3000/menu.html>.
4. When finished, stop the container:

   ```bash
   docker stop $(docker ps -q)
   ```

### Method 4: Cloudflare Workers static assets

The project also deploys as a static site with Wrangler. The build step copies
only public game files into `dist/`, so repository metadata such as `.git/`
is never uploaded as a static asset.

```bash
npm install        # install tooling (Wrangler)
npm run build      # build the static output into dist/
npm test           # run the automated server tests
npm run dev        # Cloudflare-compatible local server
npm run deploy     # deploy (npx wrangler deploy)
```

| Setting                 | Value                |
| ----------------------- | -------------------- |
| Build command           | `npm run build`      |
| Deploy command          | `npx wrangler deploy` |
| Static assets directory | `dist`               |

Cloudflare Pages can serve the same build with build command `npm run build`
and output directory `dist`. The configured deployment remains Workers Static
Assets.

Startup loads essential images and fonts before the world, then loads
optional music without blocking play. If WebGL initialization fails or the
context is lost, the game continues with Canvas2D. For troubleshooting, open
`game.html?renderBackend=p5` to select Canvas2D for that session, or
`game.html?renderBackend=pixi` to check the default renderer.

Loading failures offer Retry and Return to Menu. Save files are checked
before loading; incompatible dimensions, tile buffers, or entity coordinates
are rejected. Existing valid saves remain supported, and new saves also
retain player position and decorative props.

Wrangler reads `wrangler.jsonc`, which sets `assets.directory` to `./dist`
and runs `npm run build` before deployment.

The site root (`index.html`) redirects automatically to `menu.html`. Map
save/load requires the local Node.js server (Method 1) — it is disabled on the
deployed static site by design.

## Controls

Gameplay:

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move character |
| `Shift` | Sprint (consumes stamina) |
| `Esc` | Pause menu / back |
| `C` | Character stats |

System / debug:

| Key | Action |
| --- | --- |
| `P` | Procedural regeneration (fresh world instantly) |
| `T` | Toggle assets (sprite textures vs raw colors) |
| `Space` | Jump (experimental physics) |
| `F` | Toggle fullscreen (when permitted by the browser) |
| `F2` / `Backquote` | Open terminal cheat console |
| `Ctrl` + `'` | Alternate terminal shortcut |

## Terminal commands

In-game, open the console with `F2`, `Backquote`, or `Ctrl + '`; the menu uses
`Ctrl + '`.

| Command | Effect |
| --- | --- |
| `/kill all` | Remove all enemies from the current grid |
| `/collect all` | Collect all gold on the map |
| `/scan boss` | Detect active elite signatures and check boss health |
| `/locate boss` | Lock onto boss coordinates and calculate distance |
| `/spawn boss` | Force an Elite Beetle into the local grid |
| `/tutorial welcome` | Manually trigger the Welcome Protocol panel |
| `/tutorial reset` | Clear experience flags (shows tutorial on next load) |
| `/time [day\|night]` | Shift the game's temporal phase |
| `/health [num]` | Set health to a specific value |
| `/clear` | Wipe the terminal log history |
| `/exit` | Close the command interface |

## Engine features

### Procedural generation

- **Perlin noise terrain** — noise maps generate organic forest distribution.
- **River carving** — a custom biased "Drunken Walk" carves meandering rivers
  from map edges.
- **Cellular automata hills** — a smoothing algorithm produces natural cliff
  shapes.
- **Connectivity checks** — flood fill verifies the map is playable and spawn
  points are not trapped by water or cliffs.

### Rendering

- **Pixel-perfect scaling** — custom canvas handling keeps pixel art crisp at
  any window resolution (4K compatible).
- **Parallax layers** — background clouds and foreground elements move at
  different speeds for depth.
- **Day/night cycle** — shifting light, global darkness, and light radius
  effects (torch light).
- **Dynamic weather** — cloud shadows, humidity-based tinting, and seasonal
  variations.

### Save/load system

- **JSON map payloads** — maps serialize to JSON containing terrain data,
  object locations, and metadata.
- **Server persistence** — `scripts/map_server.js` handles read/write to the
  `maps/` directory, so worlds persist between browser refreshes.

### User interface

- **Zoom-stable UI** — menus and HUD rescale with browser zoom levels.
- **Toast notifications** — non-intrusive popups for game events (e.g. "Map
  Saved").
- **Settings menu** — audio mixers, difficulty settings, and accessibility
  options (text size).

### Audio engine

- **Dynamic mixing** — master, music, and SFX volume channels.
- **Context recovery** — handles browser autoplay policies so audio resumes
  correctly after user interaction.

## Directory structure

```text
assets/            Game sprites, music, and sound effects
maps/              JSON files for saved worlds (generated by the server)
scripts/           Node.js tooling: map_server.js (dev save/load server),
                   build-static.mjs (Cloudflare build)
src/shared/        Constants shared by menu and game
src/game/          Game modules (map, enemies, movement, HUD, UI, weather)
src/game/runtime/  Runtime layers (game loop, input, scenes, renderer, caches)
src/menu/          Menu modules (audio, settings, UI, terminal)
menu.html          Entry point for the menu
game.html          Entry point for the game
index.html         Redirects to menu.html (deployed site root)
```

## Troubleshooting

- **Map not saving** — ensure `node scripts/map_server.js` is running.
- **Audio not playing** — click anywhere on the screen to initialize the
  AudioContext.
- **Blurry graphics** — set browser zoom to 100%; the engine attempts to
  auto-correct otherwise.

## Development notes

- `game.html` pins PixiJS 7.4.3 and p5.js 1.6.0 from the CDN. npm
  dependencies are tooling-only and do not provide the browser renderer.
- HTML script order is the dependency graph. Runtime infrastructure,
  including camera shake, must load before the gameplay domains that consume
  it.
- The local map server exposes only the public game tree and JSON map routes.
  It never serves repository scripts, package metadata, editor settings, or
  dependencies.
- `npm test` runs the automated test suite (`tests/*.test.js`), which covers
  the map server, the Cloudflare runtime contract, and shared helpers.

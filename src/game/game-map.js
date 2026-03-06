// game-map.js — Map generation and river carving
// Extracted from 4-Game.js

// --- Map Generation Tuning Constants ---
const SCATTER_FOREST_PROB        = 0.18;  // probability a tile becomes forest in scatter-style generation
const COIN_SCATTER_COUNT         = 20;    // number of coins placed randomly on the map
const BEETLE_SPAWN_PROB          = 0.15;  // chance any enemy slot becomes the one-per-map beetle
const BEETLE_SEARCH_RADIUS       = 15;    // tile radius when force-placing the fallback beetle
const BEETLE_MIN_DIST            = 8;     // minimum distance from player for fallback beetle placement
const ENEMY_COUNT_NORMAL         = 12;
const ENEMY_COUNT_HARD           = 24;
const ENEMY_COUNT_EASY           = 6;
const RIVER_JUMP_INTERVAL        = 70;    // every N steps the river walker may teleport to a new edge start
const RIVER_JUMP_PROB            = 0.25;  // probability of the jump occurring
const DEFAULT_CHANCE_ENTER_CLEAR = 0.35;  // default probability a river carves through the clear zone
const DEFAULT_JITTER_NOISE_SCALE = 0.12;  // Perlin noise scale for river path jitter
const DEFAULT_WIDEN_PROB         = 0.45;  // probability each step widens the river by one neighbor tile
const BRIDGE_CHECK_RANGE         = 3;     // tiles sampled left/right when detecting river flow direction
const BRIDGE_PLACE_DIVISOR       = 6;     // caps bridge placements per connectivity-repair pass

// Returns all 8 grid-adjacent cells of (cx, cy) that are within bounds.
function neighbors8(cx, cy, w, h) {
  const n = [];
  for (let yy = cy - 1; yy <= cy + 1; yy++) {
    for (let xx = cx - 1; xx <= cx + 1; xx++) {
      if (xx === cx && yy === cy) continue;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) n.push({ x: xx, y: yy });
    }
  }
  return n;
}

// Returns true if (x, y) falls inside the protected player-start rectangle.
function isInClearRect(x, y, startX, endX, startY, endY) {
  if (startX < 0) return false;
  return x > startX && x < endX && y > startY && y < endY;
}

// Entry point: clears state and kicks off phased map generation.
function generateMap() {
  genPhase = 0;
  clearPreviousGameState();

  isTutorialMap = (localStorage.getItem('tutorialComplete') !== 'true');

  if (isTutorialMap) {
    loadTutorialMap();
    return;
  }

  genPhase = 1;
}

// Phase 1: allocates map arrays and fills terrain with noise or scatter.
function generateMap_Part1() {
  verboseLog('[game] Generating Part 1 (Base)...');

  if (!W || !H) return;

  logicalW = FIXED_MAP_WIDTH_TILES;
  logicalH = FIXED_MAP_HEIGHT_TILES;

  mapStates = new Uint8Array(logicalW * logicalH);
  terrainLayer = new Uint8Array(logicalW * logicalH);

  const clearArea = computeClearArea();

  if (typeof WeatherSystem !== 'undefined') {
      WeatherSystem.reset();
  }

  // Randomly choose between noise-based and scatter-based generation
  const generationRoll = Math.random();
  if (generationRoll < 0.5) {
      verboseLog('[game] Style: Noise-based Forest');
      applyNoiseTerrain(clearArea.centerX, clearArea.centerY, clearArea.baseClearWidth, clearArea.baseClearHeight);
  } else {
      verboseLog('[game] Style: Randomized Roughness');
      // Simple scatter with clear area protection
      for (let y = 0; y < logicalH; y++) {
          for (let x = 0; x < logicalW; x++) {
              const idx = y * logicalW + x;
              const inClearZone = (x >= clearArea.centerX - clearArea.baseClearWidth/2 &&
                                   x <= clearArea.centerX + clearArea.baseClearWidth/2 &&
                                   y >= clearArea.centerY - clearArea.baseClearHeight/2 &&
                                   y <= clearArea.centerY + clearArea.baseClearHeight/2);

              if (inClearZone) {
                  mapStates[idx] = TILE_TYPES.GRASS;
              } else {
                  mapStates[idx] = Math.random() < SCATTER_FOREST_PROB ? TILE_TYPES.FOREST : TILE_TYPES.GRASS;
              }
          }
      }
  }

  genTempData = { clearArea };
}

// Phase 2: carves rivers, places hills, spawns enemies/coins/trees, and finalises the map.
function generateMap_Part2() {
  verboseLog('[game] Generating Part 2 (Roughness)...');
  enemies = []; // CLEAR ALL PREVIOUS ENEMIES TO PREVENT DUPLICATES
  const { clearArea } = genTempData;

  // --- Phase 1: Rivers, Terrain & Connectivity ---
  const spawn = postProcessRiversAndClearArea(clearArea.clearStartX, clearArea.clearEndX, clearArea.clearStartY, clearArea.clearEndY);

  // --- Phase 2: Hills ---
  generateHills(mapStates, logicalW, logicalH);

  // --- Phase 3: Prune Unreachable Tiles ---
  pruneUnreachable(spawn.spawnX, spawn.spawnY);

  terrainLayer = mapStates.slice();
  counts = {};
  for (let i = 0; i < mapStates.length; i++) counts[mapStates[i]] = (counts[mapStates[i]] || 0) + 1;

  playerPosition = { x: spawn.spawnX, y: spawn.spawnY };
  initialSpawnPosition = { x: spawn.spawnX, y: spawn.spawnY };

  // --- Phase 4: Portal Placement ---
  // Spawn Portal roughly in the middle
  portalPos = null;
  isPortalActive = false;
  victoryShown = false;

  const midX = Math.floor(logicalW / 2);
  const midY = Math.floor(logicalH / 2);

  // Search in expanding squares from the middle to find the nearest grass tile
  let foundMid = false;
  for (let r = 0; r < Math.max(logicalW, logicalH); r++) {
      for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // Only check the perimeter of the current square

              const px = midX + dx;
              const py = midY + dy;

              if (px >= 0 && px < logicalW && py >= 0 && py < logicalH) {
                  if (mapStates[py * logicalW + px] === TILE_TYPES.GRASS) {
                      portalPos = { x: px, y: py };
                      foundMid = true;
                      break;
                  }
              }
          }
          if (foundMid) break;
      }
      if (foundMid) break;
  }

  if (portalPos) {
      console.log(`%c[PORTAL] Spawned in Middle at: ${portalPos.x}, ${portalPos.y}`, "color: #00ff00; font-weight: bold;");
  } else {
      console.error("[PORTAL] Failed to spawn portal! No grass found.");
  }

  renderX = playerPosition.x;
  renderY = playerPosition.y;
  renderStartX = renderX;
  renderStartY = renderY;
  renderTargetX = renderX;
  renderTargetY = renderY;
  isMoving = false;

  markDecorObjectsDirty();
  createMapImage();

  // --- Phase 5: Enemies ---
  try {
     let enemyCount = ENEMY_COUNT_NORMAL;
     if (difficultySetting === 'hard') enemyCount = ENEMY_COUNT_HARD;
     else if (difficultySetting === 'easy') enemyCount = ENEMY_COUNT_EASY;

     let beetleSpawned = false;
     for (let i = 0; i < enemyCount; i++) {
        let enemyX, enemyY;
        let attempts = 0;
        let invalid = true;
        do {
           enemyX = Math.floor(Math.random() * logicalW);
           enemyY = Math.floor(Math.random() * logicalH);
           attempts++;
           const tState = mapStates[enemyY * logicalW + enemyX];
           invalid = isSolid(tState) || tState === TILE_TYPES.RIVER;
        } while (attempts < 50 && invalid);

        const finalTile = mapStates[enemyY * logicalW + enemyX];
        if (!isSolid(finalTile) && finalTile !== TILE_TYPES.RIVER) {
            const roll = Math.random();
            let enemyType = roll < 0.5 ? 'mantis' : 'maggot';



            // Only spawn ONE beetle per map
            if (!beetleSpawned && Math.random() < BEETLE_SPAWN_PROB) {
                enemyType = 'beetle';
                beetleSpawned = true;
            }
            spawnEnemy(enemyType, enemyX, enemyY);
        }
     }

     // Fallback: Ensure exactly one beetle spawns, and FORCE it to be on GRASS near the player
     if (!beetleSpawned) {
        let enemyX, enemyY, attempts = 0, found = false;
        do {
           // Try to find a spot relatively near the player but not on top of them
           const angle = Math.random() * TWO_PI;
           const dist = BEETLE_MIN_DIST + Math.random() * BEETLE_SEARCH_RADIUS;
           enemyX = Math.floor(playerPosition.x + Math.cos(angle) * dist);
           enemyY = Math.floor(playerPosition.y + Math.sin(angle) * dist);
           enemyX = constrain(enemyX, 1, logicalW - 2);
           enemyY = constrain(enemyY, 1, logicalH - 2);
           attempts++;
           const tState = mapStates[enemyY * logicalW + enemyX];
           found = (tState === TILE_TYPES.GRASS);
        } while (attempts < 200 && !found);

        if (found) {
            spawnEnemy('beetle', enemyX, enemyY);
            beetleSpawned = true;
            verboseLog(`[game] Boss Beetle forced at ${enemyX}, ${enemyY}`);
        } else {
            // Absolute fallback anywhere on grass
            for (let i = 0; i < mapStates.length; i++) {
                if (mapStates[i] === TILE_TYPES.GRASS) {
                    spawnEnemy('beetle', i % logicalW, Math.floor(i / logicalW));
                    beetleSpawned = true;
                    break;
                }
            }
        }
     }

     // --- Phase 6: Scatter Coins ---
     activeCoins = [];
     for (let i = 0; i < COIN_SCATTER_COUNT; i++) {
        let cx = Math.floor(Math.random() * logicalW);
        let cy = Math.floor(Math.random() * logicalH);
        const idx = cy * logicalW + cx;
        if (mapStates[idx] === TILE_TYPES.GRASS) {
            mapStates[idx] = TILE_TYPES.COIN;
            activeCoins.push({ x: cx, y: cy });
        }
     }

     initialEnemies = enemies.map(e => ({ type: e.type, x: e.x, y: e.y }));

     // CRITICAL: Reset camera and redraw static map to prevent shifting
     smoothCamX = playerPosition.x * cellSize - width/2;
     smoothCamY = playerPosition.y * cellSize - height/2;
     createMapImage();

     try {
         showToast(t('objective'), 'warn', 5000);
     } catch(e) {}
  } catch(e) {}

  // --- Phase 7: Tree Objects ---
  treeObjects = [];
  if (TREE_OVERLAY_IMG) {
    for (let y = 0; y < logicalH; y++) {
      for (let x = 0; x < logicalW; x++) {
        const idx = y * logicalW + x;
        if (mapStates[idx] !== TILE_TYPES.FOREST) continue;
        if (x === spawn.spawnX && y === spawn.spawnY) continue;
        if (Math.random() < TREE_SPAWN_CHANCE) treeObjects.push({ x, y });
      }
    }
    createMapImage();
  }

  // --- Phase 8: Finalize & Save ---
  genTempData = {};

  redraw();
  autosaveMap();
  persistActiveMapToServer('generated');
}

// Calculates the protected clear area (player start zone) dimensions and bounds.
function computeClearArea() {
    const centerX = logicalW / 2;
    const centerY = logicalH / 2;
    const clearAreaRatio = 0.75 + Math.random() * 0.15;
    const baseClearWidth = logicalW * clearAreaRatio;
    const baseClearHeight = logicalH * clearAreaRatio;
    return {
      centerX, centerY, baseClearWidth, baseClearHeight,
      clearStartX: centerX - baseClearWidth / 2,
      clearEndX: centerX + baseClearWidth / 2,
      clearStartY: centerY - baseClearHeight / 2,
      clearEndY: centerY + baseClearHeight / 2
    };
}

// Fills mapStates with Perlin-noise-based forest/grass terrain, preserving the clear zone.
function applyNoiseTerrain(centerX, centerY, baseClearWidth, baseClearHeight) {
    const noiseScale = 0.12;

    const radiusX = logicalW / 2;
    const radiusY = logicalH / 2;

    for (let y = 0; y < logicalH; y++) {
      for (let x = 0; x < logicalW; x++) {
        const idx = y * logicalW + x;

        const dx = (x - centerX) / radiusX;
        const dy = (y - centerY) / radiusY;
        const dist = Math.hypot(dx, dy);

        const n = noise(x * noiseScale, y * noiseScale);
        const wobble = (n - 0.5) * 0.3;

        if (dist + wobble > 0.80) {
            mapStates[idx] = TILE_TYPES.FOREST;
        } else {
            mapStates[idx] = TILE_TYPES.GRASS;
        }
      }
    }
}

// Carves rivers, bridges unreachable areas, and returns the player spawn position.
function postProcessRiversAndClearArea(clearStartX, clearEndX, clearStartY, clearEndY) {
    const RIVER_TILE = (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER) ? TILE_TYPES.RIVER : null;

    carveRivers(mapStates, logicalW, logicalH, { clearStartX, clearEndX, clearStartY, clearEndY, RIVER_TILE });

    const spawnX = Math.floor(logicalW / 2);
    const spawnY = Math.floor(logicalH / 2);
    const allowClearOverride = riverClearMode === RIVER_CLEAR_MODES.AUTO ? null : (riverClearMode === RIVER_CLEAR_MODES.ALWAYS);

    carveRiversMaybeThrough(mapStates, logicalW, logicalH, {
      clearStartX, clearEndX, clearStartY, clearEndY, RIVER_TILE,
      playerX: spawnX, playerY: spawnY, allowClearOverride
    });

    const branchChance = allowClearOverride === true ? 1 : 0.55;
    if (allowClearOverride !== false && Math.random() < branchChance) {
      carveBranchFromRiver(mapStates, logicalW, logicalH, {
        clearStartX, clearEndX, clearStartY, clearEndY, RIVER_TILE, playerX: spawnX, playerY: spawnY
      });
    }

    ensureInteractiveClearArea(mapStates, logicalW, logicalH, {
      clearStartX, clearEndX, clearStartY, clearEndY, playerX: spawnX, playerY: spawnY, RIVER_TILE
    });

    smoothRiverTiles(mapStates, logicalW, logicalH, { RIVER_TILE, clearStartX, clearEndX, clearStartY, clearEndY });
    roundRiverTips(mapStates, logicalW, logicalH, { RIVER_TILE, clearStartX, clearEndX, clearStartY, clearEndY });

    return { spawnX, spawnY };
}

// BFS from (startX, startY); converts isolated non-solid tiles to FOREST (unreachable pruning).
function pruneUnreachable(startX, startY) {
    const startIdx = startY * logicalW + startX;
    if (isSolid(mapStates[startIdx])) return;
    const q = [{ x: startX, y: startY }];
    const visited = new Set([`${startX},${startY}`]);
    let head = 0;
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
      { dx: 0, dy: 1 },  { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
    ];
    while (head < q.length) {
      const { x, y } = q[head++];
      for (const d of dirs) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH) {
          const key = `${nx},${ny}`;
          const idx = ny * logicalW + nx;
          if (!visited.has(key) && !isSolid(mapStates[idx])) {
            visited.add(key);
            q.push({ x: nx, y: ny });
          }
        }
      }
    }
    for (let i = 0; i < mapStates.length; i++) {
      const x = i % logicalW;
      const y = Math.floor(i / logicalW);

      if (!isSolid(mapStates[i]) && !visited.has(`${x},${y}`)) {
        mapStates[i] = TILE_TYPES.FOREST;
      }
    }
}

// Generates hill clusters via Perlin noise + cellular automata, then renders them into map.
function generateHills(map, w, h) {
  // --- SETTINGS ---
  const scale = 0.035;
  const threshold = 0.48;
  const seed = Math.random() * 99999;
  let hillGrid = new Uint8Array(w * h);

  // 1. Initial Noise Pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < 4 || x > w - 5 || y < 4 || y > h - 5) continue;
      const n = noise((x * scale) + seed, (y * scale) + seed);
      if (n > threshold) hillGrid[y * w + x] = 1;
    }
  }

  // 2. Cellular Automata Smoothing (5 Iterations)
  for (let i = 0; i < 5; i++) {
    const nextGrid = new Uint8Array(hillGrid);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (hillGrid[(y + dy) * w + (x + dx)] === 1) neighbors++;
          }
        }
        if (hillGrid[idx] === 1) nextGrid[idx] = (neighbors >= 4) ? 1 : 0;
        else nextGrid[idx] = (neighbors >= 5) ? 1 : 0;
      }
    }
    hillGrid = nextGrid;
  }

  // 3. Strict Pruning Pass (Remove Thin/Unsupported Shapes)
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const nextGrid = new Uint8Array(hillGrid);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (hillGrid[idx] === 0) continue;

        const n    = hillGrid[(y - 1) * w + x];
        const s    = hillGrid[(y + 1) * w + x];
        const e    = hillGrid[y * w + (x + 1)];
        const west = hillGrid[y * w + (x - 1)];

        const cardinalHillCount = n + s + e + west;

        // Rule A: Isolated or Tip (0 or 1 neighbor) -> Kill
        if (cardinalHillCount < 2) {
          nextGrid[idx] = 0;
          changed = true;
          continue;
        }

        // Rule B: Thin Bar (2 neighbors, but opposite) -> Kill
        if (cardinalHillCount === 2) {
          if ((n && s) || (e && west)) {
            nextGrid[idx] = 0;
            changed = true;
            continue;
          }
        }

        // Keep valid shape (Corner or Solid)
        nextGrid[idx] = 1;
      }
    }
    hillGrid = nextGrid;
    if (!changed) break;
  }

  // 4. Render to Map
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (hillGrid[idx] === 1) {
        const tileType = getHillTileType(hillGrid, x, y, w);
        if (tileType !== 0 && tileType !== TILE_TYPES.GRASS) {
          map[idx] = tileType;
        }
      }
    }
  }
}

// Returns the specific HILL_* tile type for a hill cell based on its cardinal neighbours.
function getHillTileType(grid, x, y, w) {
  const isHill = (dx, dy) => {
    const nx = x + dx;
    const ny = y + dy;
    const h = grid.length / w;

    if (nx < 0 || nx >= w || ny < 0 || ny >= h) return false;

    return grid[ny * w + nx] === 1;
  };

  const n    = isHill(0, -1);
  const s    = isHill(0, 1);
  const e    = isHill(1, 0);
  const west = isHill(-1, 0);

  if (!n && !west) return TILE_TYPES.HILL_NORTHWEST;
  if (!n && !e)    return TILE_TYPES.HILL_NORTHEAST;
  if (!s && !west) return TILE_TYPES.HILL_SOUTHWEST;
  if (!s && !e)    return TILE_TYPES.HILL_SOUTHEAST;

  if (!n) return TILE_TYPES.HILL_NORTH;
  if (!s) return TILE_TYPES.HILL_SOUTH;
  if (!west) return TILE_TYPES.HILL_WEST;
  if (!e) return TILE_TYPES.HILL_EAST;

  return TILE_TYPES.GRASS;
}

// Carves the guaranteed main river and 2–3 natural branches across the map.
function carveRivers(map, w, h, opts) {
  const { clearStartX, clearEndX, clearStartY, clearEndY } = opts;
  const RIVER_TILE = opts.RIVER_TILE;
  const riverId = () => (RIVER_TILE !== null ? RIVER_TILE : TILE_TYPES.FOREST);

  // --- 1. MAIN RIVER (Guaranteed Middle) ---
  const isHorizontal = Math.random() < 0.5;
  let mx = isHorizontal ? 0 : w / 2 + (Math.random() - 0.5) * (w * 0.1);
  let my = isHorizontal ? h / 2 + (Math.random() - 0.5) * (h * 0.1) : 0;

  let curMX = mx;
  let curMY = my;
  let mainRiverPoints = [];

  const mainSteps = Math.max(w, h) * 1.5;
  for (let s = 0; s < mainSteps; s++) {
    // Variable thickness for a natural look
    const radius = 0.8 + noise(s * 0.1, 123) * 1.0;
    for (let dy = -Math.ceil(radius); dy <= radius; dy++) {
      for (let dx = -Math.ceil(radius); dx <= radius; dx++) {
        const nx = Math.floor(curMX + dx);
        const ny = Math.floor(curMY + dy);
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          if (dx * dx + dy * dy <= radius * radius) map[ny * w + nx] = riverId();
        }
      }
    }
    mainRiverPoints.push({x: curMX, y: curMY});

    if (isHorizontal) {
      curMX += 1.0;
      curMY += (noise(curMX * 0.04, 555) - 0.5) * 1.8;
      if (curMX >= w) break;
    } else {
      curMY += 1.0;
      curMX += (noise(curMY * 0.04, 777) - 0.5) * 1.8;
      if (curMY >= h) break;
    }
  }

  // --- 2. NATURAL BRANCHES ---
  const numBranches = 2 + Math.floor(Math.random() * 2);
  for (let b = 0; b < numBranches; b++) {
    // Pick a point on the main river to start the branch
    const startIdx = Math.floor(Math.random() * (mainRiverPoints.length * 0.6)) + Math.floor(mainRiverPoints.length * 0.2);
    const startP = mainRiverPoints[startIdx];

    let curBX = startP.x;
    let curBY = startP.y;

    // Choose a general direction away from the main path
    let angle = isHorizontal ? (Math.random() < 0.5 ? -HALF_PI : HALF_PI) : (Math.random() < 0.5 ? 0 : PI);
    angle += (Math.random() - 0.5) * 0.5;

    for (let s = 0; s < 40; s++) {
      const radius = 0.6 + noise(s * 0.1, b * 10) * 0.8;
      for (let dy = -Math.ceil(radius); dy <= radius; dy++) {
        for (let dx = -Math.ceil(radius); dx <= radius; dx++) {
          const nx = Math.floor(curBX + dx);
          const ny = Math.floor(curBY + dy);
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            if (dx * dx + dy * dy <= radius * radius) map[ny * w + nx] = riverId();
          }
        }
      }
      curBX += Math.cos(angle);
      curBY += Math.sin(angle);
      angle += (noise(s * 0.1, b * 50) - 0.5) * 0.3;
      if (curBX < 0 || curBX >= w || curBY < 0 || curBY >= h) break;
    }
  }
}

// Places a bridge tile at (x, y) and extends it across the river in the dominant flow direction.
function layBridgeTile(map, w, h, x, y, RIVER_TILE, BRIDGE_TILE) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const idx = y * w + x;
  map[idx] = BRIDGE_TILE;

  // Determine river flow direction (horizontal or vertical)
  let horizontalRiver = 0;
  let verticalRiver = 0;

  for (let d = -BRIDGE_CHECK_RANGE; d <= BRIDGE_CHECK_RANGE; d++) {
    if (x + d >= 0 && x + d < w && map[y * w + (x + d)] === RIVER_TILE) horizontalRiver++;
    if (y + d >= 0 && y + d < h && map[(y + d) * w + x] === RIVER_TILE) verticalRiver++;
  }

  const isVerticalBridge = horizontalRiver > verticalRiver;

  // Extend bridge until it hits solid ground on both sides
  const extendBridge = (dx, dy) => {
    let curX = x + dx;
    let curY = y + dy;
    while (curX >= 0 && curX < w && curY >= 0 && curY < h) {
      const cIdx = curY * w + curX;
      if (map[cIdx] === RIVER_TILE) {
        map[cIdx] = BRIDGE_TILE;
      } else {
        break; // Hit ground
      }
      curX += dx;
      curY += dy;
    }
  };

  if (isVerticalBridge) {
    extendBridge(0, 1);
    extendBridge(0, -1);
  } else {
    extendBridge(1, 0);
    extendBridge(-1, 0);
  }
}

// Iterates over all edge-layer barriers; opens any that block connectivity.
function ensureEdgeLayerConnectivity() {
  if (!EDGE_LAYER_ENABLED) return;
  if (!edgeLayer || !logicalW || !logicalH) return;
  const total = logicalW * logicalH;
  if (edgeLayer.length !== total) return;
  const reachableWithoutBarrier = floodReachable({ respectEdgeLayer: false });
  if (!reachableWithoutBarrier || reachableWithoutBarrier.length !== total) return;
  let reachableWithBarrier = floodReachable({ respectEdgeLayer: true });
  if (!reachableWithBarrier || reachableWithBarrier.length !== total) return;
  let needsFix = false;
  for (let i = 0; i < total; i++) {
    if (reachableWithoutBarrier[i] && !reachableWithBarrier[i]) {
      needsFix = true;
      break;
    }
  }
  if (!needsFix) return;
  let adjustments = 0;
  let iterations = 0;
  const maxIterations = 16;
  while (needsFix && iterations < maxIterations) {
    iterations++;
    let opened = 0;
    for (let idx = 0; idx < total; idx++) {
      if (!edgeLayer[idx]) continue;
      if (!reachableWithoutBarrier[idx]) continue;
      if (reachableWithBarrier[idx]) continue;
      const x = idx % logicalW;
      const y = Math.floor(idx / logicalW);
      let touchesReachable = false;
      if (x > 0 && reachableWithBarrier[idx - 1]) touchesReachable = true;
      if (!touchesReachable && x < logicalW - 1 && reachableWithBarrier[idx + 1]) touchesReachable = true;
      if (!touchesReachable && y > 0 && reachableWithBarrier[idx - logicalW]) touchesReachable = true;
      if (!touchesReachable && y < logicalH - 1 && reachableWithBarrier[idx + logicalW]) touchesReachable = true;
      if (!touchesReachable) continue;
      edgeLayer[idx] = 0;
      opened++;
      adjustments++;
      if (EDGE_LAYER_DEBUG) verboseLog('[game] connectivity fix: clearing barrier at', x, y);
    }
    if (!opened) break;
    reachableWithBarrier = floodReachable({ respectEdgeLayer: true });
    needsFix = false;
    for (let i = 0; i < total; i++) {
      if (reachableWithoutBarrier[i] && !reachableWithBarrier[i]) {
        needsFix = true;
        break;
      }
    }
  }
  if (adjustments > 0) {
    verboseLog('[game] ensureEdgeLayerConnectivity removed', adjustments, 'barrier tiles to keep paths accessible');
  }
}

// Carves 1–2 rivers from map edge to map edge using a guided random walk; places bridges to restore connectivity.
function carveRiversMaybeThrough(map, w, h, opts = {}) {
  const clearStartX = opts.clearStartX ?? -1;
  const clearEndX   = opts.clearEndX ?? -1;
  const clearStartY = opts.clearStartY ?? -1;
  const clearEndY   = opts.clearEndY ?? -1;

  const RIVER_TILE = (typeof opts.RIVER_TILE !== 'undefined' && opts.RIVER_TILE !== null)
    ? opts.RIVER_TILE
    : (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER ? TILE_TYPES.RIVER : null);

  const BRIDGE_TILE = (typeof opts.BRIDGE_TILE !== 'undefined' && opts.BRIDGE_TILE !== null)
    ? opts.BRIDGE_TILE
    : (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RAMP ? TILE_TYPES.RAMP : TILE_TYPES.GRASS);

  const playerX = Math.floor(opts.playerX ?? Math.floor(w / 2));
  const playerY = Math.floor(opts.playerY ?? Math.floor(h / 2));
  const numRivers = typeof opts.numRivers === 'number' ? opts.numRivers : (1 + Math.floor(Math.random() * 2));
  const allowClearOverride = typeof opts.allowClearOverride === 'boolean' ? opts.allowClearOverride : null;
  const chanceEnterClear = allowClearOverride === null
    ? (typeof opts.chanceEnterClear === 'number' ? Math.max(0, Math.min(1, opts.chanceEnterClear)) : DEFAULT_CHANCE_ENTER_CLEAR)
    : (allowClearOverride ? 1 : 0);

  const jitterNoiseScale = typeof opts.jitterNoiseScale === 'number' ? opts.jitterNoiseScale : DEFAULT_JITTER_NOISE_SCALE;
  const widenProb = typeof opts.widenProb === 'number' ? opts.widenProb : DEFAULT_WIDEN_PROB;
  const maxSteps = Math.max(w, h) * 6;

  function reachedSide(x, y, side) {
    if (side === 0) return y === 0;
    if (side === 1) return x === w - 1;
    if (side === 2) return y === h - 1;
    if (side === 3) return x === 0;
    return false;
  }

  function pickStartAndTarget() {
    const side = Math.floor(Math.random() * 4);
    let sx, sy, tx, ty;
    if (side === 0) {
      sx = Math.floor(Math.random() * w);
      sy = 0;
      tx = Math.floor((w * 0.25) + Math.random() * w * 0.5);
      ty = h - 1;
    } else if (side === 1) {
      sx = w - 1;
      sy = Math.floor(Math.random() * h);
      tx = 0;
      ty = Math.floor((h * 0.25) + Math.random() * h * 0.5);
    } else if (side === 2) {
      sx = Math.floor(Math.random() * w);
      sy = h - 1;
      tx = Math.floor((w * 0.25) + Math.random() * w * 0.5);
      ty = 0;
    } else {
      sx = 0;
      sy = Math.floor(Math.random() * h);
      tx = w - 1;
      ty = Math.floor((h * 0.25) + Math.random() * h * 0.5);
    }

    // Snap to edge if start/target falls inside the clear zone
    if (isInClearRect(sx, sy, clearStartX, clearEndX, clearStartY, clearEndY)) {
      if (side === 0) sy = 0;
      if (side === 1) sx = w - 1;
      if (side === 2) sy = h - 1;
      if (side === 3) sx = 0;
    }
    if (isInClearRect(tx, ty, clearStartX, clearEndX, clearStartY, clearEndY)) {
      if (side === 0) ty = h - 1;
      if (side === 1) tx = 0;
      if (side === 2) ty = 0;
      if (side === 3) tx = w - 1;
    }
    return { start: { x: sx, y: sy, side }, target: { x: tx, y: ty, side: (side + 2) % 4 } };
  }

  function placeRiverTile(x, y) {
    const idx = y * w + x;
    if (RIVER_TILE !== null) map[idx] = RIVER_TILE; else map[idx] = TILE_TYPES.FOREST;
  }

  function carveSingleRiver(start, target) {
    let x = start.x, y = start.y;
    let steps = 0;
    let prevDir = null;
    const allowThroughThisRiver = Math.random() < chanceEnterClear;
    while (steps < maxSteps) {
      placeRiverTile(x, y);
      const distToTarget = Math.hypot(target.x - x, target.y - y);
      const localWidenProb = distToTarget < 4 ? widenProb * 0.35 : widenProb;
      for (const n of neighbors8(x, y, w, h)) {
        if (Math.random() < localWidenProb) placeRiverTile(n.x, n.y);
      }
      if (reachedSide(x, y, target.side)) {
        if (distToTarget > 2 && Math.random() < 0.4) {
          const extras = neighbors8(x, y, w, h).filter(n => reachedSide(n.x, n.y, target.side));
          if (extras.length) {
            const e = extras[Math.floor(Math.random() * extras.length)];
            placeRiverTile(e.x, e.y);
          }
        }
        break;
      }
      // Score each candidate step: lower = preferred.
      // Penalties: inside clear zone, backtracking, diagonal step, direction change.
      let candidates = neighbors8(x, y, w, h);
      let best = null;
      let bestScore = Infinity;
      for (const c of candidates) {
        const dist = Math.hypot(target.x - c.x, target.y - c.y);
        const jitter = (noise(c.x * jitterNoiseScale, c.y * jitterNoiseScale) - 0.5) * 3;
        const inside = isInClearRect(c.x, c.y, clearStartX, clearEndX, clearStartY, clearEndY);
        const insidePenalty = inside ? (allowThroughThisRiver ? 6 : 1000) : 0;
        const forwardDot = ((target.x - x) * (c.x - x) + (target.y - y) * (c.y - y));
        const backtrackPenalty = forwardDot < 0 ? 6 : 0;
        const dirX = c.x - x;
        const dirY = c.y - y;
        const diagPenalty = (Math.abs(dirX) + Math.abs(dirY) === 2) ? 0.8 : 0;
        const turnPenalty = prevDir && (dirX !== prevDir.dx || dirY !== prevDir.dy) ? 1.4 : 0;
        const score = dist + jitter + insidePenalty + backtrackPenalty + diagPenalty + turnPenalty;
        if (score < bestScore) { bestScore = score; best = c; }
      }
      if (!best) break;
      prevDir = { dx: best.x - x, dy: best.y - y };
      x = best.x;
      y = best.y;
      steps++;
      if (steps % RIVER_JUMP_INTERVAL === 0 && Math.random() < RIVER_JUMP_PROB) {
        const p = pickStartAndTarget().start;
        x = Math.max(0, Math.min(w - 1, p.x));
        y = Math.max(0, Math.min(h - 1, p.y));
        prevDir = null;
      }
    }
  }

  for (let r = 0; r < numRivers; r++) {
    const { start, target } = pickStartAndTarget();
    carveSingleRiver(start, target);
  }

  // BFS from (px, py) over walkable tiles; returns the set of visited coordinate keys.
  function floodFillWalkable(px, py) {
    const q = [{ x: px, y: py }];
    const visited = new Set([`${px},${py}`]);
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      for (const n of neighbors8(cur.x, cur.y, w, h)) {
        const key = `${n.x},${n.y}`;
        if (visited.has(key)) continue;
        const t = map[n.y * w + n.x];
        const walkable = t === BRIDGE_TILE || t === TILE_TYPES.GRASS || t === TILE_TYPES.FLOWERS || t === TILE_TYPES.LOG;
        if (walkable) {
          visited.add(key);
          q.push({ x: n.x, y: n.y });
        }
      }
    }
    return visited;
  }

  for (let iter = 0; iter < 5; iter++) {
    const visited = floodFillWalkable(playerX, playerY);
    const unreachable = [];
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const key = `${xx},${yy}`;
        const t = map[yy * w + xx];
        if ((t === TILE_TYPES.GRASS || t === TILE_TYPES.FLOWERS || t === TILE_TYPES.LOG) && !visited.has(key)) {
          unreachable.push({ x: xx, y: yy });
        }
      }
    }
    if (unreachable.length === 0) break;
    const candidatesMap = new Map();
    const visitedSet = visited;
    for (const g of unreachable) {
      for (const n of neighbors8(g.x, g.y, w, h)) {
        const nk = `${n.x},${n.y}`;
        if (candidatesMap.has(nk)) continue;
        const t = map[n.y * w + n.x];
        if (t === RIVER_TILE) {
          let touchesVisited = false;
          for (const nn of neighbors8(n.x, n.y, w, h)) {
            if (visitedSet.has(`${nn.x},${nn.y}`)) {
              const tt = map[nn.y * w + nn.x];
              if (tt === TILE_TYPES.GRASS || tt === TILE_TYPES.FLOWERS || tt === TILE_TYPES.LOG || tt === BRIDGE_TILE) {
                touchesVisited = true;
                break;
              }
            }
          }
          if (touchesVisited) {
            const score = Math.hypot(n.x - w/2, n.y - h/2) + Math.random() * 20;
            candidatesMap.set(nk, { x: n.x, y: n.y, score });
          }
        }
      }
    }
    if (candidatesMap.size === 0) break;
    const candidates = Array.from(candidatesMap.values()).sort((a,b) => a.score - b.score);
    const placeCount = Math.min(3, Math.max(1, Math.floor(candidates.length / BRIDGE_PLACE_DIVISOR)));
    for (let i = 0; i < placeCount && i < candidates.length; i++) {
      const c = candidates[i];
      layBridgeTile(map, w, h, c.x, c.y, RIVER_TILE, BRIDGE_TILE);
    }
  }
}

// Carves a secondary river branch from an existing river tile through the player zone to the opposite edge.
function carveBranchFromRiver(map, w, h, opts = {}) {
  const RIVER_TILE = (typeof opts.RIVER_TILE !== 'undefined' && opts.RIVER_TILE !== null)
    ? opts.RIVER_TILE
    : (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER ? TILE_TYPES.RIVER : null);

  if (RIVER_TILE === null) {
    console.warn('carveBranchFromRiver: no RIVER_TILE available; aborting branch carve.');
    return;
  }

  const BRIDGE_TILE = (typeof opts.BRIDGE_TILE !== 'undefined' && opts.BRIDGE_TILE !== null)
    ? opts.BRIDGE_TILE
    : (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RAMP ? TILE_TYPES.RAMP : TILE_TYPES.GRASS);

  const playerX = Math.floor(opts.playerX ?? Math.floor(w / 2));
  const playerY = Math.floor(opts.playerY ?? Math.floor(h / 2));
  const { clearStartX = -1, clearEndX = -1, clearStartY = -1, clearEndY = -1 } = opts;

  const riverTiles = [];
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (map[yy * w + xx] === RIVER_TILE) riverTiles.push({ x: xx, y: yy });
    }
  }

  function pickEdgeStart() {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: Math.floor(Math.random() * w), y: 0 };
    if (side === 1) return { x: w - 1, y: Math.floor(Math.random() * h) };
    if (side === 2) return { x: Math.floor(Math.random() * w), y: h - 1 };
    return { x: 0, y: Math.floor(Math.random() * h) };
  }

  const start = riverTiles.length ? riverTiles[Math.floor(Math.random() * riverTiles.length)] : pickEdgeStart();

  function pickOppositeEdgeTargetFrom(sx, sy) {
    if (sx <= w / 2) return { x: w - 1, y: Math.floor(h * (0.25 + Math.random() * 0.5)) };
    if (sx > w / 2) return { x: 0, y: Math.floor(h * (0.25 + Math.random() * 0.5)) };
    if (sy <= h / 2) return { x: Math.floor(w * (0.25 + Math.random() * 0.5)), y: h - 1 };
    return { x: Math.floor(w * (0.25 + Math.random() * 0.5)), y: 0 };
  }

  const targetEdge = pickOppositeEdgeTargetFrom(start.x, start.y);

  const maxSteps = Math.max(w, h) * 6;
  const jitterNoiseScale = DEFAULT_JITTER_NOISE_SCALE;
  const widenProb = DEFAULT_WIDEN_PROB;

  function carvePath(sx, sy, tx, ty, stepsLimit = maxSteps) {
    let x = sx, y = sy;
    let steps = 0;
    let prevDir = null;
    while (steps < stepsLimit) {
      const idx = y * w + x;
      map[idx] = RIVER_TILE;

      const distToTarget = Math.hypot(tx - x, ty - y);
      const localWidenProb = distToTarget < 4 ? widenProb * 0.35 : widenProb;
      for (const n of neighbors8(x, y, w, h)) {
        const nIdx = n.y * w + n.x;
        if (Math.random() < localWidenProb) map[nIdx] = RIVER_TILE;
      }

      if (Math.hypot(tx - x, ty - y) <= 1.5) break;

      // Score each candidate step: lower = preferred.
      // Penalties: inside clear zone, backtracking, diagonal step, direction change.
      let best = null;
      let bestScore = Infinity;
      for (const c of neighbors8(x, y, w, h)) {
        const dist = Math.hypot(tx - c.x, ty - c.y);
        const jitter = (noise(c.x * jitterNoiseScale, c.y * jitterNoiseScale) - 0.5) * 3;
        const throughPlayerBias = (Math.hypot(playerX - c.x, playerY - c.y) < Math.max(w,h)*0.25) ? -2 : 0;
        const dirX = c.x - x;
        const dirY = c.y - y;
        const diagPenalty = (Math.abs(dirX) + Math.abs(dirY) === 2) ? 0.6 : 0;
        const turnPenalty = prevDir && (dirX !== prevDir.dx || dirY !== prevDir.dy) ? 1.2 : 0;
        const score = dist + jitter + throughPlayerBias + diagPenalty + turnPenalty;
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (!best) break;
      prevDir = { dx: best.x - x, dy: best.y - y };
      x = best.x; y = best.y;
      steps++;
    }
    return { x, y, steps };
  }

  carvePath(start.x, start.y, playerX, playerY, Math.floor(maxSteps * 0.6));

  let nearest = null;
  let bestD = Infinity;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (map[yy * w + xx] === RIVER_TILE) {
        const d = Math.hypot(playerX - xx, playerY - yy);
        if (d < bestD) {
          bestD = d;
          nearest = { x: xx, y: yy };
        }
      }
    }
  }
  if (nearest) {
    carvePath(nearest.x, nearest.y, targetEdge.x, targetEdge.y, maxSteps);
  }

  // BFS from (px, py) over walkable tiles; returns the set of visited coordinate keys.
  function floodFillWalkableFrom(px, py) {
    const q = [{ x: px, y: py }];
    const visited = new Set([`${px},${py}`]);
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      for (const n of neighbors8(cur.x, cur.y, w, h)) {
        const k = `${n.x},${n.y}`;
        if (visited.has(k)) continue;
        const t = map[n.y * w + n.x];
        const walkable = t === BRIDGE_TILE || t === TILE_TYPES.GRASS || t === TILE_TYPES.FLOWERS || t === TILE_TYPES.LOG;
        if (walkable) {
          visited.add(k);
          q.push({ x: n.x, y: n.y });
        }
      }
    }
    return visited;
  }

  for (let iter = 0; iter < 6; iter++) {
    const visited = floodFillWalkableFrom(playerX, playerY);
    const unreachable = [];
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const k = `${xx},${yy}`;
        const t = map[yy * w + xx];
        if ((t === TILE_TYPES.GRASS || t === TILE_TYPES.FLOWERS || t === TILE_TYPES.LOG) && !visited.has(k)) {
          unreachable.push({ x: xx, y: yy });
        }
      }
    }
    if (unreachable.length === 0) break;

    const candidates = [];
    const seen = new Set();
    for (const g of unreachable) {
      for (const n of neighbors8(g.x, g.y, w, h)) {
        const nk = `${n.x},${n.y}`;
        if (seen.has(nk)) continue;
        seen.add(nk);
        const t = map[n.y * w + n.x];
        if (t === RIVER_TILE) {
          let touchesVisited = false;
          for (const nn of neighbors8(n.x, n.y, w, h)) {
            if (visited.has(`${nn.x},${nn.y}`)) {
              const tt = map[nn.y * w + nn.x];
              if (tt === TILE_TYPES.GRASS || tt === TILE_TYPES.FLOWERS || tt === TILE_TYPES.LOG || tt === BRIDGE_TILE) {
                touchesVisited = true; break;
              }
            }
          }
          if (touchesVisited) {
            const score = Math.hypot(n.x - w/2, n.y - h/2) + Math.random() * 10;
            candidates.push({ x: n.x, y: n.y, score });
          }
        }
      }
    }
    if (candidates.length === 0) break;
    candidates.sort((a,b) => a.score - b.score);
    const placeCount = Math.min(3, Math.max(1, Math.floor(candidates.length / BRIDGE_PLACE_DIVISOR)));
    for (let i = 0; i < placeCount; i++) {
      const c = candidates[i];
      layBridgeTile(map, w, h, c.x, c.y, RIVER_TILE, BRIDGE_TILE);
    }
  }
}

// Converts river tiles near the player into LOG tiles and clears solid tiles to GRASS within the clear zone.
function ensureInteractiveClearArea(map, w, h, opts = {}) {
  const {
    clearStartX = -1,
    clearEndX = -1,
    clearStartY = -1,
    clearEndY = -1,
    playerX = Math.floor(w / 2),
    playerY = Math.floor(h / 2),
    RIVER_TILE = (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER) ? TILE_TYPES.RIVER : null
  } = opts;

  if (clearStartX < 0 || RIVER_TILE === null) return;

  const safeRadius = Math.max(2, Math.floor(Math.min(clearEndX - clearStartX, clearEndY - clearStartY) / 6));

  function insideClear(x, y) {
    return x > clearStartX && x < clearEndX && y > clearStartY && y < clearEndY;
  }

  for (let dy = -safeRadius; dy <= safeRadius; dy++) {
    for (let dx = -safeRadius; dx <= safeRadius; dx++) {
      const x = playerX + dx;
      const y = playerY + dy;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      if (!insideClear(x, y)) continue;
      const idx = y * w + x;
      const tile = map[idx];
      if (tile === RIVER_TILE) {
        map[idx] = TILE_TYPES.LOG;
      } else if (tile === TILE_TYPES.FOREST || tile === TILE_TYPES.CLIFF) {
        map[idx] = TILE_TYPES.GRASS;
      }
    }
  }

  for (let yy = clearStartY + 1; yy < clearEndY; yy++) {
    for (let xx = clearStartX + 1; xx < clearEndX; xx++) {
      if (!insideClear(xx, yy)) continue;
      const idx = yy * w + xx;
      const tile = map[idx];
      if (tile === TILE_TYPES.RIVER) continue;
      if (tile === TILE_TYPES.FOREST || tile === TILE_TYPES.CLIFF) {
        map[idx] = TILE_TYPES.GRASS;
      }
    }
  }
}

// Fills diagonal river gaps (checkerboard artifacts) to smooth river edges.
function smoothRiverTiles(map, w, h, opts = {}) {
  const {
    RIVER_TILE = (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER) ? TILE_TYPES.RIVER : null,
    clearStartX = -1,
    clearEndX = -1,
    clearStartY = -1,
    clearEndY = -1
  } = opts;

  if (RIVER_TILE === null) return;

  function blockTouchesClear(x, y) {
    if (clearStartX < 0) return false;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const bx = x + dx;
        const by = y + dy;
        if (bx > clearStartX && bx < clearEndX && by > clearStartY && by < clearEndY) {
          return true;
        }
      }
    }
    return false;
  }

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      if (blockTouchesClear(x, y)) continue;
      const idx = y * w + x;
      const topLeft = map[idx];
      const topRight = map[idx + 1];
      const bottomLeft = map[idx + w];
      const bottomRight = map[idx + w + 1];
      const diagA = topLeft === RIVER_TILE && bottomRight === RIVER_TILE && topRight !== RIVER_TILE && bottomLeft !== RIVER_TILE;
      const diagB = topRight === RIVER_TILE && bottomLeft === RIVER_TILE && topLeft !== RIVER_TILE && bottomRight !== RIVER_TILE;
      if (diagA) {
        map[idx + 1] = RIVER_TILE;
        map[idx + w] = RIVER_TILE;
      } else if (diagB) {
        map[idx] = RIVER_TILE;
        map[idx + w + 1] = RIVER_TILE;
      }
    }
  }
}

// Removes isolated river-tip pixels (single-cardinal-neighbour river tiles diagonally adjacent to another tip).
function roundRiverTips(map, w, h, opts = {}) {
  const {
    RIVER_TILE = (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER) ? TILE_TYPES.RIVER : null,
    clearStartX = -1,
    clearEndX = -1,
    clearStartY = -1,
    clearEndY = -1
  } = opts;

  if (RIVER_TILE === null) return;

  function insideClear(x, y) {
    if (clearStartX < 0) return false;
    return x > clearStartX && x < clearEndX && y > clearStartY && y < clearEndY;
  }

  const cardDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  const diagDirs = [
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: -1 }
  ];

  const toGrass = new Set();

  function countCardinalRivers(x, y) {
    let count = 0;
    for (const d of cardDirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (map[ny * w + nx] === RIVER_TILE) count++;
    }
    return count;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (map[idx] !== RIVER_TILE) continue;
      if (insideClear(x, y)) continue;

      const cardCount = countCardinalRivers(x, y);
      if (cardCount > 1) continue;

      for (const d of diagDirs) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nIdx = ny * w + nx;
        if (map[nIdx] !== RIVER_TILE) continue;
        if (insideClear(nx, ny)) continue;
        const diagCard = countCardinalRivers(nx, ny);
        if (diagCard <= 1) {
          toGrass.add(nIdx);
        }
      }
    }
  }

  for (const idx of toGrass) {
    if (map[idx] === RIVER_TILE) {
      map[idx] = TILE_TYPES.GRASS;
    }
  }
}

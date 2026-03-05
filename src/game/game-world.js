// game-world.js — Decorative objects, map image, game state, difficulty, environment
// Extracted from 4-Game.js

function drawTileToMap(lx, ly) {
  if (!mapImage || !logicalW || !logicalH) return;
  
  const tileState = getTileState(lx, ly);
  const px = lx * cellSize;
  const py = ly * cellSize;
  
  // Clear the tile area in the map buffer
  mapImage.push();
  mapImage.noStroke();
  // Assume background grass color or draw tile_1 first
  const baseTileImg = (TILE_IMAGES && TILE_IMAGES['tile_1']) ? TILE_IMAGES['tile_1'] : null;
  if (baseTileImg) {
      mapImage.image(baseTileImg, px, py, cellSize, cellSize);
  } else {
      const grassColor = getColorForState(TILE_TYPES.GRASS);
      mapImage.fill(grassColor[0], grassColor[1], grassColor[2]);
      mapImage.rect(px, py, cellSize, cellSize);
  }

  let img = null;
  let imgDestW = cellSize;
  let imgDestH = cellSize;

  if (tileState === TILE_TYPES.HEALTH && healthPotionSprite) {
    img = healthPotionSprite;
    imgDestW = cellSize * 0.7;
    imgDestH = cellSize * 0.7;
  } else if (tileState === TILE_TYPES.POWERUP && powerupPotionSprite) {
    img = powerupPotionSprite;
    imgDestW = cellSize * 0.7;
    imgDestH = cellSize * 0.7;
  } else if (tileState === TILE_TYPES.CHEST && chestSprite) {
    img = chestSprite;
    imgDestW = cellSize * 0.8;
    imgDestH = cellSize * 0.8;
  } else if (TILE_IMAGES[tileState]) {
    img = TILE_IMAGES[tileState];
    imgDestW = img.width;
    imgDestH = img.height;
  }

  if (img) {
    const drawX = px + Math.floor((cellSize - imgDestW) / 2);
    const drawY = py + (cellSize - imgDestH);
    mapImage.image(img, drawX, drawY, imgDestW, imgDestH);
  }
  mapImage.pop();
}

function createMapImage() {
  if (!logicalW || !logicalH) {
    console.warn('[createMapImage] aborted: logical size not set yet');
    return;
  }
  const w = logicalW * cellSize;
  const h = logicalH * cellSize;
  
  if (mapImage && typeof mapImage.remove === 'function') {
    try { mapImage.remove(); } catch (e) {}
  }
  mapImage = createGraphics(w, h);
  
 
  mapImage.pixelDensity(1); 
  

  try {
 
    enforceCanvasSharpness(mapImage.drawingContext);
    mapImage.noSmooth(); 
  } catch(e) {}

    if (decorObjectsDirty) {
      spawnDecorativeObjects();
      decorObjectsDirty = false;
    }

  const useSprites = showTextures && spritesheet && spritesheet.width > 1;
 
  

  const overlays = [];
  const TREE_PIXEL_SIZE = 64;

  for (let ly = 0; ly < logicalH; ly++) {
    for (let lx = 0; lx < logicalW; lx++) {
      const tileState = getTileState(lx, ly);
      const px = lx * cellSize;
      const py = ly * cellSize;
      let img = null;
      let imgDestW = cellSize;
      let imgDestH = cellSize;
      
      if (tileState === TILE_TYPES.COIN) {
          // Skip drawing coins into the static map image
          // We draw them animated in the main loop instead
          const grassImg = (TILE_IMAGES && TILE_IMAGES['tile_1']) ? TILE_IMAGES['tile_1'] : null;
          if (grassImg) mapImage.image(grassImg, px, py, cellSize, cellSize);
          continue;
      }

      if (tileState === TILE_TYPES.FOREST && TILE_IMAGES['gentle_forest']) {
        img = TILE_IMAGES['gentle_forest'];
        imgDestW = img.width;
        imgDestH = img.height;
      } else if (tileState === TILE_TYPES.GRASS && TILE_IMAGES['tile_1']) {
        img = TILE_IMAGES['tile_1'];
        imgDestW = cellSize;
        imgDestH = cellSize;
      } else if (tileState === TILE_TYPES.TREE && TILE_IMAGES['tree_1']) {
        img = TILE_IMAGES['tree_1'];
        imgDestW = TREE_PIXEL_SIZE;
        imgDestH = TREE_PIXEL_SIZE;
      } else if (tileState === TILE_TYPES.RIVER && (TILE_IMAGES['water_1'] || TILE_IMAGES[TILE_TYPES.RIVER])) {
        img = TILE_IMAGES['water_1'] || TILE_IMAGES[TILE_TYPES.RIVER];
        imgDestW = cellSize;
        imgDestH = cellSize;
      } else if ((tileState === TILE_TYPES.RAMP || tileState === TILE_TYPES.LOG) && (TILE_IMAGES['bridge_1'] || TILE_IMAGES[TILE_TYPES.RAMP] || TILE_IMAGES[TILE_TYPES.LOG])) {
        img = TILE_IMAGES['bridge_1'] || TILE_IMAGES[TILE_TYPES.RAMP] || TILE_IMAGES[TILE_TYPES.LOG];
        imgDestW = cellSize;
        imgDestH = cellSize;
      } else if (tileState === TILE_TYPES.HEALTH && healthPotionSprite) {
        img = healthPotionSprite;
        imgDestW = cellSize * 0.7;
        imgDestH = cellSize * 0.7;
      } else if (tileState === TILE_TYPES.POWERUP && powerupPotionSprite) {
        img = powerupPotionSprite;
        imgDestW = cellSize * 0.8;
        imgDestH = cellSize * 0.8;
      } else if (tileState === TILE_TYPES.CHEST && chestSprite) {
        img = chestSprite;
        imgDestW = cellSize * 0.8;
        imgDestH = cellSize * 0.8;
      } else if (TILE_IMAGES[tileState]) {
        img = TILE_IMAGES[tileState];
        imgDestW = img.width;
        imgDestH = img.height;
      }
      else if (tileState >= TILE_TYPES.HILL_NORTH && tileState <= TILE_TYPES.HILL_NORTHWEST) {
        
        const grassColor = getColorForState(TILE_TYPES.GRASS);
        const baseTileImg = (TILE_IMAGES && TILE_IMAGES['tile_1']) ? TILE_IMAGES['tile_1'] : null;
        if (baseTileImg) {
          mapImage.image(baseTileImg, px, py, cellSize, cellSize);
        } else {
          mapImage.fill(grassColor[0], grassColor[1], grassColor[2]);
          mapImage.noStroke();
          mapImage.rect(px, py, cellSize, cellSize);
        }

        const direction = Object.keys(TILE_TYPES).find(key => TILE_TYPES[key] === tileState).replace('HILL_', '').toLowerCase();
        img = HILL_ASSETS[direction];
        if (img) {
          imgDestW = cellSize;
          imgDestH = cellSize;
        }
      }
      
      if (img) {
        const drawX = px + Math.floor((cellSize - imgDestW) / 2);
        const drawY = py + (cellSize - imgDestH);
        
        // --- BRIDGE SHADOW ---
        if (tileState === TILE_TYPES.RAMP || tileState === TILE_TYPES.LOG) {
            mapImage.push();
            mapImage.noStroke();
            mapImage.fill(0, 0, 0, 80);
            mapImage.rect(px + 4, py + 4, cellSize, cellSize); // Simple drop shadow
            mapImage.pop();
        }

        mapImage.image(img, drawX, drawY, imgDestW, imgDestH);
      } else {
        const c = getColorForState(tileState);
        mapImage.fill(c[0], c[1], c[2]);
        mapImage.noStroke();
        mapImage.rect(px, py, cellSize, cellSize);
      }

      // --- RIVER BANKS ---
      if (tileState === TILE_TYPES.GRASS) {
          // Check for adjacent water
          const neighbors = [
              {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}
          ];
          let isNearWater = false;
          for (const n of neighbors) {
              if (getTileState(lx + n.dx, ly + n.dy) === TILE_TYPES.RIVER) {
                  isNearWater = true;
                  break;
              }
          }
          if (isNearWater) {
              mapImage.push();
              mapImage.noStroke();
              mapImage.fill(0, 0, 0, 40); // Subtle darkening for the bank
              mapImage.rect(px, py, cellSize, cellSize);
              mapImage.pop();
          }
      }

      if (tileState >= TILE_TYPES.HILL_NORTH && tileState <= TILE_TYPES.HILL_NORTHWEST) {
        try {
          const gradH = Math.max(8, Math.min(Math.floor(cellSize * 0.5), 48));
          const maxAlpha = 220;
          const grassImg = (TILE_IMAGES && TILE_IMAGES['tile_1']) ? TILE_IMAGES['tile_1'] : null;
          if (grassImg) {
            for (let row = 0; row < gradH; row++) {
              const y = cellSize - gradH + row;
              const alpha = map(row, 0, Math.max(1, gradH - 1), 0, maxAlpha);
              mapImage.noStroke();
              mapImage.tint(255, alpha);
              try {
                const srcH = Math.max(1, Math.floor((grassImg.height || 1) - 1));
                mapImage.image(grassImg, px, py + y, cellSize, 1, 0, srcH, grassImg.width, 1);
              } catch (e) {
                mapImage.image(grassImg, px, py + y, cellSize, 1);
              }
              mapImage.noTint();
            }
          } else {
            const grassColor2 = getColorForState(TILE_TYPES.GRASS);
            for (let y = cellSize - gradH; y < cellSize; y++) {
              let alpha = map(y, cellSize - gradH, cellSize, 0, maxAlpha);
              mapImage.noStroke();
              mapImage.fill(grassColor2[0], grassColor2[1], grassColor2[2], alpha);
              mapImage.rect(px, py + y, cellSize, 1);
            }
          }
        } catch (e) {}
      }
    }
  }

  if (Array.isArray(treeObjects) && treeObjects.length) {
    for (const t of treeObjects) {
      const px = t.x * cellSize;
      const py = t.y * cellSize;
      let destW = cellSize;
      let destH = cellSize;
      if (TREE_OVERLAY_IMG) {
        destW = TREE_PIXEL_SIZE;
        destH = TREE_PIXEL_SIZE;
      } else if (SPRITES && SPRITES[TILE_TYPES.FOREST]) {
        const s = SPRITES[TILE_TYPES.FOREST];
        destW = (s.drawW && Number(s.drawW) > 0) ? s.drawW : cellSize;
        destH = (s.drawH && Number(s.drawH) > 0) ? s.drawH : cellSize;
      }
      overlays.push({
        tileState: TILE_TYPES.FOREST,
        px, py,
        imgType: (TREE_OVERLAY_IMG ? 'image' : 'none'),
        img: TREE_OVERLAY_IMG || null,
        s: null,
        destW,
        destH,
        source: 'treeObject'
      });
    }
  }

  try {
    for (let ly = 0; ly < logicalH; ly++) {
      for (let lx = 0; lx < logicalW; lx++) {
        const ts = getTileState(lx, ly);
        if (ts !== TILE_TYPES.FOREST) continue;
        const px = lx * cellSize;
        const py = ly * cellSize;
        const exists = overlays.some(o => o && o.px === px && o.py === py);
        if (exists) continue;
        let destW = cellSize;
        let destH = cellSize;
        if (TREE_OVERLAY_IMG) {
            destW = TREE_PIXEL_SIZE;
            destH = TREE_PIXEL_SIZE;
        } else if (SPRITES && SPRITES[TILE_TYPES.FOREST]) {
          const s = SPRITES[TILE_TYPES.FOREST];
          destW = (s.drawW && Number(s.drawW) > 0) ? s.drawW : cellSize;
          destH = (s.drawH && Number(s.drawH) > 0) ? s.drawH : cellSize;
        }
        overlays.push({ tileState: TILE_TYPES.FOREST, px, py, imgType: (TREE_OVERLAY_IMG ? 'image' : 'none'), img: TREE_OVERLAY_IMG || null, s: null, destW, destH, source: 'mapForest' });
      }
    }
  } catch (e) {}

  overlays.sort((a, b) => ( (a.py + (cellSize - a.destH)) - (b.py + (cellSize - b.destH)) ));
  try {
    const total = (logicalW || 0) * (logicalH || 0);
    if (!edgeLayer || !(edgeLayer instanceof Uint8Array) || edgeLayer.length !== total) {
      edgeLayer = new Uint8Array(total);
    } else {
      edgeLayer.fill(0);
    }

    verboseLog('[game] overlays total=', overlays.length, 'sample=', overlays.slice(0,6).map(o=>({px:o.px,py:o.py,destW:o.destW,destH:o.destH,imgType:o.imgType})));
    for (const o of overlays) {
      if (!o || o.tileState !== TILE_TYPES.FOREST) continue;
      const drawX = o.px + Math.floor((cellSize - o.destW) / 2);
      const drawY = o.py + (cellSize - o.destH);
      const drawRight = drawX + o.destW;
      const drawBottom = drawY + o.destH;
      const minTileX = Math.max(0, Math.floor(drawX / cellSize));
      const maxTileX = Math.min(logicalW - 1, Math.floor((drawRight - 1) / cellSize));
      const minTileY = Math.max(0, Math.floor(drawY / cellSize));
      const maxTileY = Math.min(logicalH - 1, Math.floor((drawBottom - 1) / cellSize));
      const fromTreeObject = o.source === 'treeObject';
      const baseTileX = Math.max(0, Math.min(logicalW - 1, Math.floor(o.px / cellSize)));
      const baseTileY = Math.max(0, Math.min(logicalH - 1, Math.floor(o.py / cellSize)));
      let markedCount = 0;
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (fromTreeObject && ty !== baseTileY) continue;
        for (let tx = minTileX; tx <= maxTileX; tx++) {
          if (fromTreeObject && tx !== baseTileX) continue;
          try {
            const idx = ty * logicalW + tx;
            const ts = getTileState(tx, ty);
            if (isSolid(ts)) continue;
            let shouldMark = false;
            const tileLeft = tx * cellSize;
            const tileTop = ty * cellSize;
            const tileRight = tileLeft + cellSize;
            const tileBottom = tileTop + cellSize;
            const overlapLeft = Math.max(drawX, tileLeft);
            const overlapTop = Math.max(drawY, tileTop);
            const overlapRight = Math.min(drawRight, tileRight);
            const overlapBottom = Math.min(drawBottom, tileBottom);
            const overlapWidth = Math.max(0, overlapRight - overlapLeft);
            const overlapHeight = Math.max(0, overlapBottom - overlapTop);
            const coverage = (overlapWidth * overlapHeight) / (cellSize * cellSize);
            const coverageThreshold = fromTreeObject ? 0.05 : 0.45;
            if (coverage >= coverageThreshold) {
              shouldMark = true;
            } else if (fromTreeObject && tx === baseTileX && ty === baseTileY) {
              shouldMark = true;
            }
            if (!shouldMark) continue;
        
          } catch (e) {}
        }
      }
      try {
        for (const t of treeObjects) {
          if (!t) continue;
          if ((t.x * cellSize) === o.px && (t.y * cellSize) === o.py) {
            t._overlay = t._overlay || {};
            t._overlay.coveredTiles = { minTileX, maxTileX, minTileY, maxTileY };
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.warn('[game] compute edgeLayer failed', e);
  }
  try {
    ensureEdgeLayerConnectivity();
  } catch (e) {
    console.warn('[game] ensureEdgeLayerConnectivity failed', e);
  }
  try {
    mapOverlays = overlays.slice();
  } catch (e) { mapOverlays = overlays; }
  try {
    if (!useSprites && edgeLayer && logicalW && logicalH) {
      if (!EDGE_LAYER_ENABLED) {
        verboseLog('[game] edgeLayer painting skipped because EDGE_LAYER_ENABLED=false');
      } else {
        let cnt = 0;
        for (let i = 0; i < edgeLayer.length; i++) cnt += edgeLayer[i] ? 1 : 0;
        verboseLog('[game] painting edgeLayer into raw mapImage - barrier tiles=', cnt, 'logical=', logicalW, 'x', logicalH, 'useSprites=', useSprites);
        mapImage.noStroke();
        const c = EDGE_LAYER_COLOR || [34, 120, 34, 200];
        mapImage.fill(c[0], c[1], c[2], c[3] || 200);
        for (let yy = 0; yy < logicalH; yy++) {
          for (let xx = 0; xx < logicalW; xx++) {
            const idx = yy * logicalW + xx;
            if (edgeLayer[idx]) {
              mapImage.rect(xx * cellSize, yy * cellSize, cellSize, cellSize);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[game] failed to paint edgeLayer into raw map image', e);
  }
  
  // --- MINIMAP CACHE ---
  if (mapImage) {
    try {
        if (minimapImage) minimapImage.remove();
        minimapImage = createGraphics(200, 200);
        
        const mapAspect = mapImage.width / mapImage.height;
        let drawW = 200;
        let drawH = 200 / mapAspect;
        if (drawH > 200) {
           drawH = 200;
           drawW = 200 * mapAspect;
        }
        
        minimapImage.background(0, 0, 0, 0); // Transparent
        minimapImage.image(mapImage, 0, 0, drawW, drawH);
    } catch(e) { console.warn('[game] failed to create minimap cache', e); }
  }
}

function clearPreviousGameState() {
  try {
    if (mapImage && typeof mapImage.remove === 'function') {
      mapImage.remove();
    }
  } catch (e) {}
  mapImage = null;
  mapOverlays = [];
  decorativeObjectsList = [];
  decorativeObstaclePositions = new Set();
  treeObjects = [];
  enemies = [];
  counts = {};
  decorObjectsDirty = true;
  edgeLayer = null;
  mapStates = null;
  terrainLayer = null;
  playerPosition = null;
  renderX = renderY = renderStartX = renderStartY = renderTargetX = renderTargetY = 0;
  isMoving = false;
  queuedMove = null;
  isJumping = false;
  clouds.length = 0;
  lastCloudSpawn = 0;
  overlayProgress = 0;
  overlayProgressActive = false;
  overlayProgressLastUpdate = 0;
  showLoadingOverlay = true;
  mapLoadComplete = false;
  portalPos = null;
  isPortalActive = false;
  victoryShown = false;
}

function markDecorObjectsDirty() {
  decorObjectsDirty = true;
}

function spawnDecorativeObjects() {
  if (!logicalW || !logicalH || !mapStates) return;
  decorativeObjectsList = [];
  decorativeObstaclePositions = new Set();
  decorativeBehindObstacleTiles = new Set();
  const grassTiles = [];
  for (let y = 0; y < logicalH; y++) {
    for (let x = 0; x < logicalW; x++) {
      if (getTileState(x, y) === TILE_TYPES.GRASS) {
        grassTiles.push({ x, y });
      }
    }
  }
  if (!grassTiles.length) return;
  const maxDecor = Math.max(4, Math.round(grassTiles.length * DECOR_MAX_DENSITY));
  const maxObstacles = Math.max(1, Math.round(grassTiles.length * DECOR_MAX_OBSTACLE_DENSITY));
  let obstaclesPlaced = 0;
  const ordered = grassTiles.slice();
  shuffleArray(ordered);
  const occupied = new Set();

  const placeRandomDecor = (tile, type, pool) => {
    if (!pool || !pool.length) return false;
    const name = pool[Math.floor(Math.random() * pool.length)];
    decorativeObjectsList.push({ id: name, type, tileX: tile.x, tileY: tile.y });
    const idx = tile.y * logicalW + tile.x;
    occupied.add(idx);
    
    if (type === 'obstacle') {
        decorativeObstaclePositions.add(idx);
    }
    return true;
  };

  for (const tile of ordered) {
    if (decorativeObjectsList.length >= maxDecor) break;
    const tileIdx = tile.y * logicalW + tile.x;
    if (occupied.has(tileIdx)) continue;
    const roll = Math.random();
    if (obstaclesPlaced < maxObstacles && roll < DECOR_OBSTACLE_SPAWN_CHANCE) {
      if (placeRandomDecor(tile, 'obstacle', DECORATIVE_OBSTACLE_NAMES)) {
        obstaclesPlaced++;
      }
    } else if (roll < DECOR_OBSTACLE_SPAWN_CHANCE + DECOR_WALKABLE_SPAWN_CHANCE) {
      placeRandomDecor(tile, 'walkable', DECORATIVE_WALKABLE_NAMES);
    }
  }

  const anchorX = Math.max(0, Math.min(logicalW - 1, Math.floor(logicalW / 2)));
  const anchorY = Math.max(0, Math.min(logicalH - 1, Math.floor(logicalH / 2)));
  const holeCandidates = grassTiles.slice().sort((a, b) => {
    return (Math.hypot(a.x - anchorX, a.y - anchorY) - Math.hypot(b.x - anchorX, b.y - anchorY));
  });
  for (const tile of holeCandidates) {
    const idx = tile.y * logicalW + tile.x;
    if (occupied.has(idx)) continue;
    decorativeObjectsList.push({ id: DECOR_SPECIAL_NAMES[0], type: 'special', tileX: tile.x, tileY: tile.y });
    occupied.add(idx);
    break;
  }
}

function RandomEnvironment() {
  const idx = Math.floor(Math.random() * ENVIRONMENTS.length);
  const env = ENVIRONMENTS[idx];
  currentEnvironment = env;
  applyEnvironmentDefaults(env);
  return env;
}

function applyEnvironmentDefaults(env) {
}

function normalizeDifficultyValue(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return DIFFICULTIES.includes(normalized) ? normalized : null;
}

function setDifficulty(value, { regenerate = true, reason = 'unknown' } = {}) {
  const normalized = normalizeDifficultyValue(value);
  if (!normalized) return false;
  if (normalized === currentDifficulty) return false;
  currentDifficulty = normalized;
  verboseLog(`[game] difficulty set to ${normalized} (${reason})`);
  if (regenerate && typeof generateMap === 'function' && W && H) {
    generateMap();
  }
  return true;
}

function getDifficultyDisplayLabel(value = currentDifficulty) {
  return DIFFICULTY_LABELS[value] || DIFFICULTY_LABELS.normal;
}


// ── Decor density constants ──
const DECOR_MAX_DENSITY = 0.07;
const DECOR_MAX_OBSTACLE_DENSITY = 0.02;
const DECOR_WALKABLE_SPAWN_CHANCE = 0.06;
const DECOR_OBSTACLE_SPAWN_CHANCE = 0.025;

function clearObjectValues(target) {
      if (!target || typeof target !== 'object') return;
      Object.keys(target).forEach((key) => { target[key] = null; });
    }


function releaseGameAssets() {
      clearPreviousGameState();
      releaseImageReference(spritesheetIdle);
      releaseImageReference(spritesheetWalk);
      releaseImageReference(spritesheetRun);
      spritesheetIdle = null;
      spritesheetWalk = null;
      spritesheetRun = null;

      releaseImageReference(BUTTON_BG);
      releaseImageReference(TREE_OVERLAY_IMG);
      releaseImageReference(uiFont);
      BUTTON_BG = null;
      TREE_OVERLAY_IMG = null;
      uiFont = null;

      clearObjectValues(TILE_IMAGES);
      clearObjectValues(DECOR_ASSET_IMAGES);
      clearObjectValues(HILL_ASSETS);

      if (Array.isArray(cloudImages)) cloudImages.length = 0;

      try {
        if (gameMusic && typeof gameMusic.stop === 'function') {
          gameMusic.stop();
        }
      } catch (stopErr) {}
      gameMusic = null;
      clickSFX = null;

      if (typeof AssetTracker !== 'undefined') {
        AssetTracker.loaded = 0;
        AssetTracker.expected = 0;
        if (AssetTracker.names && typeof AssetTracker.names.clear === 'function') {
          AssetTracker.names.clear();
        }
        AssetTracker._callbacks = [];
        AssetTracker._resolve = null;
        AssetTracker._readyPromise = null;
      }
      genTempData = {};
    }


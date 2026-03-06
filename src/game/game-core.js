// game-core.js — p5.js lifecycle: setup, draw, windowResized, resize helpers
// Extracted from 4-Game.js

// Map-generation phase IDs stored in `genPhase`
const GENPHASE_START = 1; // show loading overlay, set initial message
const GENPHASE_PART1 = 2; // wait one frame, then run generateMap_Part1
const GENPHASE_PART2 = 3; // wait for heavy work, then run generateMap_Part2

// Player bounding-box height relative to cellSize (used for tree-fade overlap test)
const PLAYER_BBOX_HEIGHT_SCALE = 1.25;

function setup() {
  verboseLog("!!! NEW VERSION LOADED !!! - FIXED_VIRTUAL_HEIGHT = " + FIXED_VIRTUAL_HEIGHT);
  
  // Initialize procedural sprites
  healthPotionSprite = createPotionGraphics([255, 50, 50]); // Red Potion
  powerupPotionSprite = createSpeedPotionGraphics(); // Speed Potion
  chestSprite = createChestGraphics();
  
  W = windowWidth;
  H = windowHeight;

  let canvasStyle = document.createElement('style');
  canvasStyle.innerHTML = `
    canvas {
      image-rendering: crisp-edges !important;
      -ms-interpolation-mode: nearest-neighbor !important;
    }
    body, html {
      margin: 0;
      padding: 0;
      background-color: #0a1f04;
      background-image:
        linear-gradient(rgba(0, 0, 0, 0.8), rgba(12, 36, 10, 0.3)),
        linear-gradient(0deg, rgba(0, 0, 0, 0.7) 0%, transparent 20%, transparent 80%, rgba(0, 0, 0, 0.7) 100%),
        url('assets/1-Background/2-Game/1-Forest/tile_1.png');
      background-size: 220px 220px, cover, 420px 420px;
      background-repeat: repeat, no-repeat, repeat;
      background-attachment: fixed;
      background-blend-mode: multiply, normal;
    }
    @supports (image-rendering: -moz-crisp-edges) {
      canvas { image-rendering: -moz-crisp-edges !important; }
    }
    @supports (image-rendering: -o-pixelated) {
      canvas { image-rendering: -o-pixelated !important; }
    }
    @supports (image-rendering: -webkit-pixelated) {
      canvas { image-rendering: -webkit-pixelated !important; }
    }
    @supports (image-rendering: pixelated) {
      canvas { image-rendering: pixelated !important; }
    }
    #gd-loading-content {
      transform-origin: center center;
      transition: transform 0.1s ease-out;
    }
  `;
  document.head.appendChild(canvasStyle);

  applyFPS();
 
  pixelDensity(window.devicePixelRatio || 1);


  gameScale = H / FIXED_VIRTUAL_HEIGHT;
  virtualW = W / gameScale;
  virtualH = H / gameScale;

  let cnv = createCanvas(W, H);
  ensureTextSizeOverride();
  
  try {
    enforceCanvasSharpness(drawingContext);
    if (cnv && cnv.elt) {
      const cnvCtx = typeof cnv.elt.getContext === 'function' ? cnv.elt.getContext('2d', { willReadFrequently: true }) : null;
      enforceCanvasSharpness(cnvCtx);
      cnv.elt.style.imageRendering = "pixelated"; 
    }
    noSmooth(); 
  } catch (e) {}

  try { injectCustomStyles(); } catch (e) {}
  
  loadLocalSettings();
  applyCurrentTextSize();
  const urlParams = new URLSearchParams(window.location.search);
  const urlMasterVol = parseFloat(urlParams.get('masterVol'));
  const urlMusicVol = parseFloat(urlParams.get('musicVol'));
  const urlSfxVol = parseFloat(urlParams.get('sfxVol'));
  if (!Number.isNaN(urlMasterVol)) masterVol = urlMasterVol;
  if (!Number.isNaN(urlMusicVol)) musicVol = urlMusicVol;
  if (!Number.isNaN(urlSfxVol)) sfxVol = urlSfxVol;
  const urlDifficulty = urlParams.get('difficulty');
  if (urlDifficulty) setDifficulty(urlDifficulty, { regenerate: false, reason: 'url-param' });
  
  const urlRiverClear = (urlParams.get('riverClear') || '').toLowerCase();
  if (urlRiverClear === RIVER_CLEAR_MODES.ALWAYS || urlRiverClear === 'true') {
    riverClearMode = RIVER_CLEAR_MODES.ALWAYS;
  } else if (urlRiverClear === RIVER_CLEAR_MODES.NEVER || urlRiverClear === 'false') {
    riverClearMode = RIVER_CLEAR_MODES.NEVER;
  } else {
    riverClearMode = RIVER_CLEAR_MODES.AUTO;
  }


  try {
    document.addEventListener('pointerdown', (ev) => {
      const el = ev.target;
      if (!el) return;
      const isButton =
        el.tagName === 'BUTTON' ||
        (el.closest && el.closest('button')) ||
        (el.getAttribute && el.getAttribute('role') === 'button');
      if (!isButton) return;
      try { unlockAudioAndStart(() => { try { playClickSFX(); } catch (e) {} }); }
      catch (e) { try { playClickSFX(); } catch (ee) {} }
    }, { capture: true });
  } catch (e) {}
  
  let loadedFromStorage = false;
  let loadedFromServer = false;
  let serverFetchPromise = Promise.resolve(false);

  try {
    const loc = window.location;
    const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
    const forceServer = urlParams.get('useServer') === '1';
    if (isLocal || forceServer) {
      serverFetchPromise = tryFetchActiveMap();
    }
  } catch (e) {}

  AssetTracker.waitReady(3500).then((ready) => {
    if (ready) {
      verboseLog('[game] assets loaded. Pre-warming clouds...');
      
     
      const mapW = (logicalW || 150) * cellSize;
      for(let i = 0; i < 40; i++) {
          spawnCloud(Math.random() * mapW); 
      }
    }

    const runAutoGenerator = () => { generateMap(); };

    serverFetchPromise.then((serverLoaded) => {
      if (isTutorialMap) {
          verboseLog('[game] Tutorial map active, bypassing server and local saves.');
          runAutoGenerator();
          return;
      }
      if (serverLoaded) {
         if (persistentGameId && persistentGameId.startsWith('server_default_')) {
             runAutoGenerator();
         }
         return;
      }
      if (loadMapFromStorage()) return;
      runAutoGenerator();
    }).catch((err) => { runAutoGenerator(); });
    
    try {
      serverFetchPromise.finally(() => {
          setTimeout(() => {
             if (typeof mapLoadComplete === 'undefined' || !mapLoadComplete) {
                 if (genPhase === 0) generateMap();
             }
          }, 1000);
      });
    } catch(e) {}
    
    if (!ready) {
      try {
        AssetTracker.onReady(() => {
          try { createMapImage(); redraw(); } catch (e) {}
        });
      } catch (e) {}
    }
  });

  applyFPS();
  
  if (gameMusic) gameMusic.setVolume(musicVol * masterVol);
  if (pendingGameActivated) { try { _confirmResize(); pendingGameActivated = false; } catch (e) {} }
}

function applyFPS() {
  if (typeof frameRate === 'function') {
    if (targetFps && targetFps > 0) {
      frameRate(targetFps);
      verboseLog('[game] framerate target set to ' + targetFps);
    } else {
      frameRate(60); // fallback
    }
  }
}

function windowResized() {
  try {
    clearTimeout(_resizeConfirmTimer);
  } catch (e) {}
  _lastRequestedSize = { w: windowWidth, h: windowHeight };
  _resizeConfirmTimer = setTimeout(() => {
    if (_lastRequestedSize.w === windowWidth && _lastRequestedSize.h === windowHeight) {
      _confirmResize();
    } else {
      windowResized();
    }
  }, 200);
}

function _confirmResize() {
  _resizeConfirmTimer = null;

  W = windowWidth;
  H = windowHeight;


  pixelDensity(window.devicePixelRatio || 1);
  

  const mapW = (logicalW || 0) * cellSize;
  const mapH = (logicalH || 0) * cellSize;
  if (mapW <= 0 || mapH <= 0) {
    resizeCanvas(W, H);
    return;
  }

  // Use fixed virtual height for consistent zoom
  gameScale = Math.max(0.001, H / FIXED_VIRTUAL_HEIGHT);
  virtualW = W / gameScale;
  virtualH = H / gameScale;

  resizeCanvas(W, H);
  

  try {
    enforceCanvasSharpness(drawingContext);
    const cnv = select('canvas');
    if (cnv && cnv.elt) {
      const cnvCtx = typeof cnv.elt.getContext === 'function' ? cnv.elt.getContext('2d', { willReadFrequently: true }) : null;
      enforceCanvasSharpness(cnvCtx);
      cnv.elt.style.imageRendering = "pixelated";
    }
  } catch (e) {}

  if (typeof mapStates === 'undefined' || !mapStates || mapStates.length === 0) {
    return;
  }

  try { createMapImage(); } catch (e) { console.warn('createMapImage failed', e); }
  redraw();
}

function createFullWindowCanvas() {
  W = windowWidth;
  H = windowHeight;
  createCanvas(W, H);
  pixelDensity(1);
}

function draw() {
  try { enforceCanvasSharpness(drawingContext); } catch (e) {}
  
  // Clamp deltaTime to prevent huge jumps after lag/tab switch
  gameDelta = (typeof deltaTime !== 'undefined') ? Math.min(deltaTime, 50) : FRAME_TIME_MS;

  if (typeof WeatherSystem !== 'undefined' && !inGameMenuVisible && !settingsOverlayDiv && !isGameOver) {
    const wasNight = isNightTime();
    WeatherSystem.update(gameDelta);
    const nowNight = isNightTime();
    // Spawn ghosts when night begins; despawn when night ends
    if (!wasNight && nowNight) spawnNightGhosts();
    else if (wasNight && !nowNight) despawnGhosts();
  }

  if (genPhase > 0) {
    if (genPhase === GENPHASE_START) {
      showLoadingOverlay = true;
      startLoadingProgress(0);
      overlayMessage = 'Initializing World...';
      updateLoadingOverlayDom();
      background(0);
      genTimer = millis() + 100;
      genPhase = GENPHASE_PART1;
      return;
    }
    if (genPhase === GENPHASE_PART1) {
      background(0);
      if (millis() < genTimer) return;
      generateMap_Part1();
      overlayMessage = 'Roughening & Eroding...';
      updateLoadingOverlayDom();
      genTimer = millis() + 800;
      genPhase = GENPHASE_PART2;
      return;
    }
    if (genPhase === GENPHASE_PART2) {
      background(0);
      if (millis() < genTimer) return;
      generateMap_Part2();
      genPhase = 0;
      showLoadingOverlay = false;
      completeLoadingProgress();
      updateLoadingOverlayDom();
    }
  }


  if (typeof window !== 'undefined' && !window.__gameDebugShown) {
    verboseLog('[game] draw() running');
    window.__gameDebugShown = true;
  }
  
  try {
    ensureLoadingOverlayDom();
    updateLoadingOverlayDom();
  } catch (e) {}

  push();


  if (gameScale !== 1) scale(gameScale);

  // --- CAMERA LOGIC ---
  let targetCamX = 0;
  let targetCamY = 0;
  const mapW = (logicalW || 0) * cellSize;
  const mapH = (logicalH || 0) * cellSize;

  if (playerPosition) {
      const pX = isMoving ? renderX : playerPosition.x;
      const pY = isMoving ? renderY : playerPosition.y;
      
      const playerPixelX = pX * cellSize + cellSize / 2;
      const playerPixelY = pY * cellSize + cellSize / 2;
      
      targetCamX = playerPixelX - virtualW / 2;
      targetCamY = playerPixelY - virtualH / 2;
      
      if (mapW > virtualW) {
        targetCamX = Math.max(0, Math.min(targetCamX, mapW - virtualW));
      } else {
        targetCamX = -(virtualW - mapW) / 2;
      }

      if (mapH > virtualH) {
        targetCamY = Math.max(0, Math.min(targetCamY, mapH - virtualH));
      } else {
        targetCamY = -(virtualH - mapH) / 2;
      }
  }

  // Camera Smoothing
  if (smoothCamX === null || smoothCamY === null) {
    smoothCamX = targetCamX;
    smoothCamY = targetCamY;
  } else {
    // Adaptive smoothing based on frame time (normalized to ~60fps)
    // 0.18 is the base lerp at 60Hz; scales smoothly for 144Hz+
    const t = 1 - Math.pow(1 - 0.18, gameDelta / FRAME_TIME_MS);
    smoothCamX = lerp(smoothCamX, targetCamX, t);
    smoothCamY = lerp(smoothCamY, targetCamY, t);
  }

  // Use floor to prevent sub-pixel shimmering on tiles
  const drawCamX = Math.floor(smoothCamX);
  const drawCamY = Math.floor(smoothCamY);

  background(34, 139, 34);

  // START WORLD TRANSFORM
  push();
  // Apply Screen Shake inside camera transform
  if (screenShakeTimer > 0 && screenShakeEnabled) {
      translate(random(-screenShakeAmount, screenShakeAmount), random(-screenShakeAmount, screenShakeAmount));
      screenShakeTimer -= gameDelta;
  } else if (screenShakeTimer > 0) {
      // Still decrement the timer even if visually disabled so logic completes
      screenShakeTimer -= gameDelta;
  }
  
  translate(-drawCamX, -drawCamY);
  
  if (mapImage) image(mapImage, 0, 0);

  if (showLoadingOverlay) {
    pop(); 
    background(0); 
    pop(); 
    return;        
  }
  
  if (playerPosition) {
    if (playerHealth <= 0 && !isGameOver) {
      triggerGameOver();
    }
  
    if (!settingsOverlayDiv && !inGameMenuVisible && !isGameOver) {
      handleMovement();
      updateMovementInterpolation();
      
      // Mana Regeneration
      if (playerMana < maxMana) {
          playerMana = Math.min(maxMana, playerMana + 0.05 * (gameDelta / 16.67));
      }

      updateEnemies();
      updateProjectiles();
      updateVFX();
      
      if (playerAttackCooldownTimer > 0) {
          playerAttackCooldownTimer -= gameDelta;
      }

      // VICTORY CHECK
      if (enemies && enemies.length === 0 && !hasAnyCoins() && !victoryShown) {
          triggerVictory();
      }

      // PORTAL ENTRY
      if (isPortalActive && portalPos && playerPosition) {
          const d = dist(playerPosition.x, playerPosition.y, portalPos.x, portalPos.y);
          if (d < 0.8) {
              verboseLog('[game] Entered Portal! Generating next map.');
              isPortalActive = false;
              victoryShown = false;
              generateMap(); // Create a whole new world
              try { showToast(t('world_cleared'), 'info', 3500); } catch(e) {}
          }
      }
    }
  }


  try {
    drawablePoolIdx = 0;
    currentDrawables.length = 0;

    if (Array.isArray(mapOverlays)) {
      for (const o of mapOverlays) {
          if (!o) continue;
          if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
          const d = drawablePool[drawablePoolIdx++];
          d.type = 'overlay';
          d.o = o;
          d.drawX = o.px + Math.floor((cellSize - o.destW) / 2);
          d.drawY = o.py + (cellSize - o.destH);
          d.baseY = o.py + cellSize;
          currentDrawables.push(d);
        }
    }
    if (Array.isArray(decorativeObjectsList) && decorativeObjectsList.length) {
      for (const deco of decorativeObjectsList) {
        const img = DECOR_ASSET_IMAGES[deco.id];
        if (!img) continue;
        const destW = img.width || cellSize;
        const destH = img.height || cellSize;
        if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
        const d = drawablePool[drawablePoolIdx++];
        d.type = 'decor';
        d.img = img;
        d.drawX = deco.tileX * cellSize + Math.floor((cellSize - destW) / 2);
        d.drawY = deco.tileY * cellSize + (cellSize - destH);
        d.destW = destW;
        d.destH = destH;
        d.baseY = deco.tileY * cellSize + cellSize;
        currentDrawables.push(d);
      }
    }

    if (typeof activeCoins !== 'undefined' && activeCoins) {
      for (const coin of activeCoins) {
          if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
          const d = drawablePool[drawablePoolIdx++];
          d.type = 'coin';
          d.tileX = coin.x;
          d.tileY = coin.y;
          d.baseY = (coin.y * cellSize) + cellSize;
          currentDrawables.push(d);
      }
    }

    if (playerPosition) {
      const drawTileX = isMoving ? renderX : playerPosition.x;
      const drawTileY = isMoving ? renderY : playerPosition.y;
      if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
      const d = drawablePool[drawablePoolIdx++];
      d.type = 'player';
      d.baseY = (drawTileY * cellSize) + cellSize;
      currentDrawables.push(d);
    }
    if (enemies && enemies.length) {
      for (const e of enemies) {
           if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
           const d = drawablePool[drawablePoolIdx++];
           d.type = 'enemy';
           d.entity = e;
           d.baseY = (e.renderY * cellSize) + cellSize; 
           currentDrawables.push(d);
      }
    }
    if (projectiles && projectiles.length) {
      for (const p of projectiles) {
           if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
           const d = drawablePool[drawablePoolIdx++];
           d.type = 'projectile';
           d.entity = p;
           d.baseY = (p.y * cellSize) + cellSize;
           currentDrawables.push(d);
      }
    }
    if (vfx && vfx.length) {
      for (const effect of vfx) {
           if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
           const d = drawablePool[drawablePoolIdx++];
           d.type = 'vfx';
           d.entity = effect;
           d.baseY = (effect.y * cellSize) + cellSize;
           currentDrawables.push(d);
      }
    }
    if (portalPos) {
        if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
        const d = drawablePool[drawablePoolIdx++];
        d.type = 'portal';
        d.x = portalPos.x;
        d.y = portalPos.y;
        d.baseY = (portalPos.y * cellSize) + cellSize;
        currentDrawables.push(d);
    }
    currentDrawables.sort((a, b) => (a.baseY - b.baseY));
    
    // Calculate player bounding box for fading
    let pRect = null;
    if (playerPosition) {
        const pX = isMoving ? renderX : playerPosition.x;
        const pY = isMoving ? renderY : playerPosition.y;
        const pW = cellSize;
        const pH = cellSize * PLAYER_BBOX_HEIGHT_SCALE;
        pRect = {
            x: pX * cellSize + (cellSize/2) - (pW/2),
            y: pY * cellSize + cellSize - pH,
            w: pW,
            h: pH
        };
    }

    for (const d of currentDrawables) {
      switch (d.type) {
        case 'overlay': {
          const o = d.o;
          let alpha = 255;
          // Fade tree if player is visually behind it
          if (pRect && d.baseY > pRect.y + pRect.h * 0.5) {
            if (pRect.x < d.drawX + o.destW && pRect.x + pRect.w > d.drawX &&
                pRect.y < d.drawY + o.destH && pRect.y + pRect.h > d.drawY) {
              alpha = 140;
            }
          }
          if (alpha < 255) tint(255, alpha);
          if (o.imgType === 'image' && o.img) image(o.img, d.drawX, d.drawY, o.destW, o.destH);
          else if (o.imgType === 'sheet' && o.s) image(spritesheet, d.drawX, d.drawY, o.destW, o.destH, o.s.x, o.s.y, o.s.w, o.s.h);
          if (alpha < 255) noTint();
          break;
        }
        case 'decor':
          try { if (d.img) image(d.img, d.drawX, d.drawY, d.destW, d.destH); } catch (e) {}
          break;
        case 'coin': {
          if (coinAnimSprite && coinAnimSprite.width > 0) {
            const frameCount = 4;
            const frame = Math.floor(millis() / 150) % frameCount;
            const fw = coinAnimSprite.width / frameCount;
            const fh = coinAnimSprite.height;
            const drawSize = cellSize * 0.8;
            image(coinAnimSprite,
              d.tileX * cellSize + (cellSize - drawSize) / 2,
              d.tileY * cellSize + (cellSize - drawSize) / 2,
              drawSize, drawSize, frame * fw, 0, fw, fh);
          }
          break;
        }
        case 'player':
          try { drawPlayer(); } catch (e) {}
          break;
        case 'enemy':
          // Ghosts are batched after the main loop under one blend-mode switch
          if (d.entity && d.entity.type === 'ghost') break;
          try { d.entity.draw(); } catch (e) {}
          break;
        case 'projectile':
        case 'vfx':
          try { d.entity.draw(); } catch (e) {}
          break;
        case 'portal': {
          const sheet = isPortalActive ? portalActiveSheet : portalInactiveSheet;
          if (sheet && sheet.width > 0) {
            const frameCount = 6;
            const frame = Math.floor(millis() / 150) % frameCount;
            const fw = sheet.width / frameCount;
            const fh = sheet.height;
            const drawSize = cellSize * 2.0;
            image(sheet,
              d.x * cellSize + (cellSize - drawSize) / 2,
              d.y * cellSize + (cellSize - drawSize),
              drawSize, drawSize, frame * fw, 0, fw, fh);
          } else {
            // Visual Fallback
            fill(isPortalActive ? [255, 215, 0] : [100, 100, 100], 180);
            stroke(255);
            strokeWeight(2);
            rect(d.x * cellSize, d.y * cellSize, cellSize, cellSize, 4);
            noStroke();
            fill(255);
            textAlign(CENTER);
            gTextSize(10);
            text("PORTAL", d.x * cellSize + cellSize/2, d.y * cellSize + cellSize/2 + 4);
          }
          break;
        }
      }
    }

    // Batch-draw all ghosts under a single blend-mode switch (no allocation).
    if (enemies && enemies.length) {
      let hasGhosts = false;
      for (let gi = 0; gi < enemies.length; gi++) {
        if (enemies[gi].type === 'ghost') { hasGhosts = true; break; }
      }
      if (hasGhosts) {
        drawingContext.globalCompositeOperation = 'screen';
        for (let gi = 0; gi < enemies.length; gi++) {
          if (enemies[gi].type === 'ghost') {
            try { enemies[gi].draw(); } catch (e) {}
          }
        }
        drawingContext.globalCompositeOperation = 'source-over';
      }
    }
  } catch (e) {}

  drawClouds();

  if (EDGE_LAYER_DEBUG && edgeLayer && logicalW && logicalH) {
    noStroke();
    fill(255, 0, 0, 100);
    for (let y = 0; y < logicalH; y++) {
      for (let x = 0; x < logicalW; x++) {
        if (edgeLayer[y * logicalW + x]) rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  // Night  // Weather Overlay Pass
  if (typeof WeatherSystem !== 'undefined') {
      const isNight = WeatherSystem.cycle > 0.8 || WeatherSystem.cycle < 0.2;
      WeatherSystem.drawAmbientParticles(smoothCamX, smoothCamY, isNight);
      WeatherSystem.drawOverlay(smoothCamX, smoothCamY, logicalW * cellSize, logicalH * cellSize);
  }
  // Night Ambience: Fireflies
  if (typeof WeatherSystem !== 'undefined' && (WeatherSystem.cycle < 0.3 || WeatherSystem.cycle > 0.7)) {
      if (showParticles && random(1) < 0.03) {
          spawnFirefly();
      }
  }

  // --- Night overlay — drawn INSIDE the world transform so scale(gameScale) applies ---
  if (typeof WeatherSystem !== 'undefined') {
      const lights = [];
      if (playerPosition) {
          const pX = isMoving ? renderX : playerPosition.x;
          const pY = isMoving ? renderY : playerPosition.y;
          const screenX = (pX * cellSize + cellSize/2) - drawCamX;
          const screenY = (pY * cellSize + cellSize/2) - drawCamY;

          lights.push({
              x: screenX,
              y: screenY,
              radius: 450 + Math.sin(millis() / 200) * 10
          });
      }
      // Add lights from VFX (like fireflies)
      if (vfx && vfx.length) {
          for (const effect of vfx) {
              if (!showFireflyLighting && effect.type === 'firefly') continue;
              if (typeof effect.getLight === 'function') {
                  const l = effect.getLight();
                  if (l) {
                      lights.push({
                          x: l.worldX - drawCamX,
                          y: l.worldY - drawCamY,
                          radius: l.radius || 40
                      });
                  }
              }
          }
      }
      // Add lights from enemies (ghost glow)
      if (enemies && enemies.length) {
          for (const e of enemies) {
              if (typeof e.getLight === 'function') {
                  const l = e.getLight();
                  if (l) {
                      lights.push({
                          x: l.worldX - drawCamX,
                          y: l.worldY - drawCamY,
                          radius: l.radius || 40
                      });
                  }
              }
          }
      }

      // Virtual screen size + overscan; round to prevent lightMap recreation from float drift
      const vW = Math.ceil(virtualW || (width / gameScale)) + 20;
      const vH = Math.ceil(virtualH || (height / gameScale)) + 20;
      WeatherSystem.drawOverlay(vW, vH, lights, drawCamX, drawCamY);
  }

  pop(); // END WORLD TRANSFORM



  // --- MINIMAP --- (Handled in game-hud.js via drawMinimap)
  if (hudEnabled) {
    drawDifficultyBadge();
    drawXPBar();
    drawHealthBar();
    drawManaBar();
    drawBossHealthBar();
    drawSprintMeter();
    drawInventory();
    drawScore();
    drawCompass();
    if (showMinimap) drawMinimap();
    if (typeof WeatherSystem !== 'undefined') {
      const vW = virtualW || (width / gameScale);
      WeatherSystem.drawClock(vW - 60, 40, 25);
    }
    if (showFps && typeof frameRate === 'function') {
      const vW = virtualW || (width / gameScale);
      
      const currentFps = frameRate();
      if (currentFps > 0) {
        fpsHistory.push(currentFps);
        if (fpsHistory.length > 60) fpsHistory.shift();
      }

      let avgFps = 0, low1Fps = 0;
      if (fpsHistory.length > 0) {
        avgFps = fpsHistory.reduce((a, b) => a + b) / fpsHistory.length;
        const sorted = [...fpsHistory].sort((a, b) => a - b);
        const low1Index = Math.max(0, Math.floor(sorted.length * 0.01));
        low1Fps = sorted[low1Index];
      }

      push();
      
      // Pixel Art Bronze Frame
      const boxW = 110;
      const boxH = 46;
      const boxX = vW - 120;
      const boxY = 80;
      
      // Drop shadow
      noStroke();
      fill(0, 120);
      rect(boxX + 2, boxY + 2, boxW, boxH, 2);
      
      // Dark metallic backing
      stroke(50, 40, 30);
      strokeWeight(3);
      fill(35, 30, 25);
      rect(boxX, boxY, boxW, boxH, 2);
      
      // Inner gold inlay
      stroke(180, 150, 50);
      strokeWeight(1.5);
      noFill();
      rect(boxX + 2, boxY + 2, boxW - 4, boxH - 4, 1);
      
      // Corner rivets
      fill(100, 90, 80);
      noStroke();
      rect(boxX + 4, boxY + 4, 2, 2);
      rect(boxX + boxW - 6, boxY + 4, 2, 2);
      rect(boxX + 4, boxY + boxH - 6, 2, 2);
      rect(boxX + boxW - 6, boxY + boxH - 6, 2, 2);

      // Text rendering
      gTextSize(14);
      
      fill(220, 220, 220); // Silver/grey 
      textAlign(LEFT, CENTER);
      text(`AVG: ${Math.round(avgFps)}`, boxX + 12, boxY + 14);
      
      fill(200, 100, 100);
      gTextSize(12);
      text(`1% LOW: ${Math.round(low1Fps)}`, boxX + 12, boxY + 30);
      
      pop();
    }
  }

  try {
    if (typeof drawInGameMenu === 'function') drawInGameMenu();
  } catch (e) {}

  if (!inGameMenuVisible && !settingsOverlayDiv) updateClouds();

  if (showTutorialsSetting) {
    handleTutorialLogic();
    drawTutorial();
  }

  pop(); // End Top level Push

  drawVignette();
}


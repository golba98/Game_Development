// game-core.js — p5.js lifecycle: setup, draw, windowResized, resize helpers
// Extracted from 4-Game.js

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
      try {
        const el = ev.target;
        if (!el) return;
        const isButton = (el.tagName === 'BUTTON') || (el.closest && el.closest('button')) || (el.getAttribute && el.getAttribute('role') === 'button');
        if (!isButton) return;
        try {
          unlockAudioAndStart(() => {
            try { playClickSFX(); } catch (e) {}
          });
        } catch (e) {
          try { playClickSFX(); } catch (ee) {}
        }
      } catch (e) {}
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
  
  if (gameMusic) gameMusic.setVolume(musicVol * masterVol);
  if (pendingGameActivated) { try { _confirmResize(); pendingGameActivated = false; } catch (e) {} }
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
  gameDelta = (typeof deltaTime !== 'undefined') ? Math.min(deltaTime, 50) : 16.67;

  if (typeof WeatherSystem !== 'undefined' && !inGameMenuVisible && !settingsOverlayDiv && !isGameOver) {
    WeatherSystem.update(gameDelta);
  }

  if (genPhase > 0) {
    if (genPhase === 1) {
      showLoadingOverlay = true;
      startLoadingProgress(0);
      overlayMessage = 'Initializing World...';
      updateLoadingOverlayDom();
      background(0);
      genTimer = millis() + 100;
      genPhase = 2; return; 
    }
    if (genPhase === 2) {
      background(0);
      if (millis() < genTimer) return;
      generateMap_Part1();
      overlayMessage = 'Roughening & Eroding...';
      updateLoadingOverlayDom();
      genTimer = millis() + 800;
      genPhase = 3; return;
    }
    if (genPhase === 3) {
      background(0);
      if (millis() < genTimer) return;
      generateMap_Part2();
      genPhase = 0;
      showLoadingOverlay = false;
      completeLoadingProgress();
      updateLoadingOverlayDom();
    }
  }


  if (typeof window !== 'undefined' && window && window.__gameDebugShown !== true) { 
    verboseLog('[game] draw() running'); window.__gameDebugShown = true; 
  }
  
  try { ensureLoadingOverlayDom(); updateLoadingOverlayDom(); } catch (e) {}

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
    const t = 1 - Math.pow(1 - 0.18, gameDelta / 16.67);
    smoothCamX = lerp(smoothCamX, targetCamX, t);
    smoothCamY = lerp(smoothCamY, targetCamY, t);
  }

  // Use floor to prevent sub-pixel shimmering on tiles
  const drawCamX = Math.floor(smoothCamX);
  const drawCamY = Math.floor(smoothCamY);

  background(34, 139, 34);

  // START WORLD TRANSFORM
  push();
  
  let shakeX = 0;
  let shakeY = 0;
  if (screenShakeTimer > 0) {
      shakeX = random(-screenShakeAmount, screenShakeAmount);
      shakeY = random(-screenShakeAmount, screenShakeAmount);
      screenShakeTimer -= gameDelta;
  }
  
  translate(-drawCamX + shakeX, -drawCamY + shakeY);
  
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

    if (mapStates && logicalW && logicalH) {
      for (let i = 0; i < mapStates.length; i++) {
        if (mapStates[i] === TILE_TYPES.COIN) {
          if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
          const d = drawablePool[drawablePoolIdx++];
          d.type = 'coin';
          const lx = i % logicalW;
          const ly = Math.floor(i / logicalW);
          d.tileX = lx;
          d.tileY = ly;
          d.baseY = (ly * cellSize) + cellSize;
          currentDrawables.push(d);
        }
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
        const pH = cellSize * 1.25;
        pRect = {
            x: pX * cellSize + (cellSize/2) - (pW/2),
            y: pY * cellSize + cellSize - pH,
            w: pW,
            h: pH
        };
    }

    for (const d of currentDrawables) {
      if (d.type === 'overlay') {
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
      } else if (d.type === 'decor') {
        try { if (d.img) image(d.img, d.drawX, d.drawY, d.destW, d.destH); } catch (e) {}
      } else if (d.type === 'coin') {
        if (coinAnimSprite && coinAnimSprite.width > 0) {
            const frameCount = 4;
            const frame = Math.floor(millis() / 150) % frameCount;
            const fw = coinAnimSprite.width / frameCount;
            const fh = coinAnimSprite.height;
            const drawSize = cellSize * 0.8;
            image(coinAnimSprite, d.tileX * cellSize + (cellSize - drawSize) / 2, d.tileY * cellSize + (cellSize - drawSize) / 2, drawSize, drawSize, frame * fw, 0, fw, fh);
        }
      } else if (d.type === 'player') {
        try { drawPlayer(); } catch (e) {}
      } else if (d.type === 'enemy') {
        try { d.entity.draw(); } catch (e) {}
      } else if (d.type === 'projectile') {
        try { d.entity.draw(); } catch (e) {}
      } else if (d.type === 'vfx') {
        try { d.entity.draw(); } catch (e) {}
      } else if (d.type === 'portal') {
        const sheet = isPortalActive ? portalActiveSheet : portalInactiveSheet;
        if (sheet && sheet.width > 0) {
            const frameCount = 6; // Updated to 6 frames
            const frame = Math.floor(millis() / 150) % frameCount;
            const fw = sheet.width / frameCount;
            const fh = sheet.height;
            const drawSize = cellSize * 2.0; 
            image(sheet, d.x * cellSize + (cellSize - drawSize) / 2, d.y * cellSize + (cellSize - drawSize), drawSize, drawSize, frame * fw, 0, fw, fh);
        } else {
            // Visual Fallback
            fill(isPortalActive ? [255, 215, 0] : [100, 100, 100], 180);
            stroke(255); strokeWeight(2);
            rect(d.x * cellSize, d.y * cellSize, cellSize, cellSize, 4);
            noStroke(); fill(255); textAlign(CENTER); gTextSize(10);
            text("PORTAL", d.x * cellSize + cellSize/2, d.y * cellSize + cellSize/2 + 4);
        }
      }
    }
  } catch (e) {}

  drawClouds();

  if (EDGE_LAYER_DEBUG && edgeLayer && logicalW && logicalH) {
    noStroke(); fill(255, 0, 0, 100);
    for (let y = 0; y < logicalH; y++) {
      for (let x = 0; x < logicalW; x++) {
        if (edgeLayer[y * logicalW + x]) rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  pop(); // END WORLD TRANSFORM

  // Night Ambience: Fireflies
  if (typeof WeatherSystem !== 'undefined' && (WeatherSystem.cycle < 0.3 || WeatherSystem.cycle > 0.7)) {
      if (random(1) < 0.03) { 
          spawnFirefly();
      }
  }

  if (typeof WeatherSystem !== 'undefined') {
      const lights = [];
      if (playerPosition) {
          const pX = isMoving ? renderX : playerPosition.x;
          const pY = isMoving ? renderY : playerPosition.y;
          // Calculate screen coordinates based on camera (defined in draw scope)
          // We assume drawCamX/Y are available. If not, we recalculate or use globals if available.
          // Since drawCamX is local to draw(), we might need to recalculate or ensure scope.
          // Let's rely on drawCamX/Y being in scope as this is inside draw().
          
          const screenX = (pX * cellSize + cellSize/2) - drawCamX;
          const screenY = (pY * cellSize + cellSize/2) - drawCamY;
          
          lights.push({
              x: screenX, 
              y: screenY, 
              radius: 300 + Math.sin(millis() / 200) * 10 // Breathing light effect
          });
      }
      // Add lights from VFX (like fireflies)
      if (vfx && vfx.length) {
          for (const effect of vfx) {
              if (typeof effect.getLight === 'function') {
                  const l = effect.getLight();
                  if (l) {
                      const screenX = l.worldX - drawCamX;
                      const screenY = l.worldY - drawCamY;
                      lights.push({
                          x: screenX,
                          y: screenY,
                          radius: l.radius
                      });
                  }
              }
          }
      }
      
      WeatherSystem.drawOverlay(width, height, lights);
  }



  // --- MINIMAP ---
  if (showMinimap && mapImage) {
    const mmW = 200;
    const mmH = 200;
    // Move to Bottom-Left
    const mmX = 20;
    const mmY = (virtualH || height) - mmH - 20;

    push();
    // Background Fog
    fill(0, 0, 0, 180);
    // Gold Border
    stroke(MENU_GOLD_BORDER);
    strokeWeight(3);
    rect(mmX, mmY, mmW, mmH, 4);
    noStroke();

    // Map content
    const mapAspect = mapImage.width / mapImage.height;
    let drawW = mmW;
    let drawH = mmW / mapAspect;
    if (drawH > mmH) {
       drawH = mmH;
       drawW = mmH * mapAspect;
    }
    const offX = (mmW - drawW) / 2;
    const offY = (mmH - drawH) / 2;
    
    // Draw map with slight transparency to blend better with fog
    tint(255, 230);
    if (minimapImage) {
        image(minimapImage, mmX + offX, mmY + offY, drawW, drawH);
    } else {
        image(mapImage, mmX + offX, mmY + offY, drawW, drawH);
    }
    noTint();

    // Draw Trees on Minimap
    if (treeObjects && logicalW && logicalH) {
       fill(15, 70, 15); // Dark Pine Green
       stroke(0, 150);   // Black outline for contrast
       strokeWeight(1);
       for(const t of treeObjects) {
          const pxRel = t.x / logicalW;
          const pyRel = t.y / logicalH;
          const tx = mmX + offX + (pxRel * drawW);
          const ty = mmY + offY + (pyRel * drawH);
          circle(tx, ty, 4);
       }
    }

    // Draw Portal on Minimap
    if (portalPos) {
       fill(isPortalActive ? [255, 215, 0] : [100, 100, 100]);
       stroke(0, 150); strokeWeight(1);
       const pxRel = portalPos.x / logicalW;
       const pyRel = portalPos.y / logicalH;
       const tx = mmX + offX + (pxRel * drawW);
       const ty = mmY + offY + (pyRel * drawH);
       rect(tx - 3, ty - 3, 6, 6);
    }

    // Player marker (Arrow)
    if (playerPosition) {
      const pX = isMoving ? renderX : playerPosition.x;
      const pY = isMoving ? renderY : playerPosition.y;
      
      const pxRel = pX / logicalW;
      const pyRel = pY / logicalH;
      
      const markerX = mmX + offX + (pxRel * drawW);
      const markerY = mmY + offY + (pyRel * drawH);
      
      // Calculate rotation
      const dirMap = { 
          'N': -HALF_PI, 'NE': -QUARTER_PI, 
          'E': 0, 'SE': QUARTER_PI, 
          'S': HALF_PI, 'SW': HALF_PI + QUARTER_PI, 
          'W': PI, 'NW': -HALF_PI - QUARTER_PI 
      };
      const angle = dirMap[lastDirection || 'S'] ?? HALF_PI;

      push();
      translate(markerX, markerY);
      rotate(angle);
      
      // Arrow Shape
      fill(255);
      stroke(0, 0, 0, 150);
      strokeWeight(1);
      beginShape();
      vertex(5, 0);    // Tip
      vertex(-4, -4);  // Back Left
      vertex(-2, 0);   // Inner Notch
      vertex(-4, 4);   // Back Right
      endShape(CLOSE);
      pop();
    }
    pop();
  }

  if (hudEnabled) {
    drawDifficultyBadge();
    drawHealthBar();
    drawBossHealthBar();
    drawSprintMeter();
    drawInventory();
    drawScore();
    drawCompass();
    if (showMinimap) drawMinimap();
    if (typeof WeatherSystem !== 'undefined') {
      WeatherSystem.drawClock(width / 2, 40, 25);
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


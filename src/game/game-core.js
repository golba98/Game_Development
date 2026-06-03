// game-core.js — p5.js lifecycle: setup, draw, windowResized, resize helpers
// Extracted from 4-Game.js

// Map-generation phase IDs stored in `genPhase`
const GENPHASE_START = 1; // show loading overlay, set initial message
const GENPHASE_PART1 = 2; // wait one frame, then run generateMap_Part1
const GENPHASE_PART2 = 3; // wait for heavy work, then run generateMap_Part2

// Player bounding-box height relative to cellSize (used for tree-fade overlap test)
const PLAYER_BBOX_HEIGHT_SCALE = 1.25;

function setup() {
  verboseLog(
    "!!! NEW VERSION LOADED !!! - FIXED_VIRTUAL_HEIGHT = " +
      FIXED_VIRTUAL_HEIGHT,
  );

  // Initialize procedural sprites
  healthPotionSprite = createPotionGraphics([255, 50, 50]); // Red Potion
  powerupPotionSprite = createSpeedPotionGraphics(); // Speed Potion
  chestSprite = createChestGraphics();

  W = windowWidth;
  H = windowHeight;

  let canvasStyle = document.createElement("style");
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

  pixelDensity(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY));

  gameScale = H / FIXED_VIRTUAL_HEIGHT;
  virtualW = W / gameScale;
  virtualH = H / gameScale;

  let cnv = createCanvas(W, H);
  ensureTextSizeOverride();

  try {
    enforceCanvasSharpness(drawingContext);
    if (cnv && cnv.elt) {
      const cnvCtx =
        typeof cnv.elt.getContext === "function"
          ? cnv.elt.getContext("2d", { willReadFrequently: true })
          : null;
      enforceCanvasSharpness(cnvCtx);
      cnv.elt.style.imageRendering = "pixelated";
    }
    noSmooth();
  } catch (e) {}

  // Dev-only render instrumentation: count drawImage calls per frame.
  // Enable with ?renderstats=1. p5's image() ultimately calls
  // drawingContext.drawImage, so this captures every source (map, sprites,
  // clouds, weather overlay, HUD) with near-zero cost when disabled.
  try {
    if (new URLSearchParams(window.location.search).get("renderstats") === "1") {
      RenderStats.enabled = true;
    }
    if (drawingContext && !drawingContext.__drawImagePatched) {
      const _origDrawImage = drawingContext.drawImage.bind(drawingContext);
      drawingContext.drawImage = function (...args) {
        if (RenderStats.enabled) RenderStats.drawImageCount++;
        return _origDrawImage(...args);
      };
      drawingContext.__drawImagePatched = true;
    }
  } catch (e) {}

  // Arm the dev perf overlay (?debug=1 / ?renderstats=1). No-op in production.
  try {
    if (typeof PerfOverlay !== "undefined") PerfOverlay.init();
  } catch (e) {}

  try {
    injectCustomStyles();
  } catch (e) {}

  loadLocalSettings();
  applyCurrentTextSize();
  const urlParams = new URLSearchParams(window.location.search);
  const urlMasterVol = parseFloat(urlParams.get("masterVol"));
  const urlMusicVol = parseFloat(urlParams.get("musicVol"));
  const urlSfxVol = parseFloat(urlParams.get("sfxVol"));
  if (!Number.isNaN(urlMasterVol)) masterVol = urlMasterVol;
  if (!Number.isNaN(urlMusicVol)) musicVol = urlMusicVol;
  if (!Number.isNaN(urlSfxVol)) sfxVol = urlSfxVol;
  const urlDifficulty = urlParams.get("difficulty");
  if (urlDifficulty)
    setDifficulty(urlDifficulty, { regenerate: false, reason: "url-param" });

  const urlRiverClear = (urlParams.get("riverClear") || "").toLowerCase();
  if (urlRiverClear === RIVER_CLEAR_MODES.ALWAYS || urlRiverClear === "true") {
    riverClearMode = RIVER_CLEAR_MODES.ALWAYS;
  } else if (
    urlRiverClear === RIVER_CLEAR_MODES.NEVER ||
    urlRiverClear === "false"
  ) {
    riverClearMode = RIVER_CLEAR_MODES.NEVER;
  } else {
    riverClearMode = RIVER_CLEAR_MODES.AUTO;
  }

  try {
    document.addEventListener(
      "pointerdown",
      (ev) => {
        const el = ev.target;
        if (!el) return;
        const isButton =
          el.tagName === "BUTTON" ||
          (el.closest && el.closest("button")) ||
          (el.getAttribute && el.getAttribute("role") === "button");
        if (!isButton) return;
        try {
          unlockAudioAndStart(() => {
            try {
              playClickSFX();
            } catch (e) {}
          });
        } catch (e) {
          try {
            playClickSFX();
          } catch (ee) {}
        }
      },
      { capture: true },
    );
  } catch (e) {}

  let loadedFromStorage = false;
  let loadedFromServer = false;
  let serverFetchPromise = Promise.resolve(false);

  try {
    const loc = window.location;
    const isLocal =
      loc.hostname === "localhost" || loc.hostname === "127.0.0.1";
    const forceServer = urlParams.get("useServer") === "1";
    if (isLocal || forceServer) {
      serverFetchPromise = tryFetchActiveMap();
    }
  } catch (e) {}

  AssetTracker.waitReady(3500).then((ready) => {
    if (ready) {
      verboseLog("[game] assets loaded. Pre-warming clouds...");

      const mapW = (logicalW || 150) * cellSize;
      for (let i = 0; i < 40; i++) {
        spawnCloud(Math.random() * mapW);
      }
    }

    const runAutoGenerator = () => {
      generateMap();
    };

    serverFetchPromise
      .then((serverLoaded) => {
        if (isTutorialMap) {
          verboseLog(
            "[game] Tutorial map active, bypassing server and local saves.",
          );
          runAutoGenerator();
          return;
        }
        if (serverLoaded) {
          if (
            persistentGameId &&
            persistentGameId.startsWith("server_default_")
          ) {
            runAutoGenerator();
          }
          return;
        }
        if (loadMapFromStorage()) return;
        runAutoGenerator();
      })
      .catch((err) => {
        runAutoGenerator();
      });

    try {
      serverFetchPromise.finally(() => {
        setTimeout(() => {
          if (typeof mapLoadComplete === "undefined" || !mapLoadComplete) {
            if (genPhase === 0) generateMap();
          }
        }, 1000);
      });
    } catch (e) {}

    if (!ready) {
      try {
        AssetTracker.onReady(() => {
          try {
            createMapImage();
            redraw();
          } catch (e) {}
        });
      } catch (e) {}
    }
  });

  applyFPS();

  if (gameMusic) gameMusic.setVolume(musicVol * masterVol);
  if (pendingGameActivated) {
    try {
      _confirmResize();
      pendingGameActivated = false;
    } catch (e) {}
  }
}

function applyFPS() {
  if (typeof frameRate === "function") {
    const fpsMode = normalizeFpsMode(targetFps, DEFAULT_SETTINGS.fpsMode);
    targetFps = getFpsTargetForMode(fpsMode);
    // Unlimited removes the finite game-side p5 frame pacing cap. Browser
    // requestAnimationFrame/VSync can still naturally land near refresh rate.
    if (fpsMode === "unlimited") {
      frameRate(INTERNAL_UNCAPPED_FRAME_RATE);
      verboseLog("[game] framerate target set to unlimited");
    } else {
      frameRate(targetFps);
      verboseLog("[game] framerate target set to " + targetFps);
    }
  }
}

function windowResized() {
  try {
    clearTimeout(_resizeConfirmTimer);
  } catch (e) {}
  _lastRequestedSize = { w: windowWidth, h: windowHeight };
  _resizeConfirmTimer = setTimeout(() => {
    if (
      _lastRequestedSize.w === windowWidth &&
      _lastRequestedSize.h === windowHeight
    ) {
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

  pixelDensity(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY));

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
    const cnv = select("canvas");
    if (cnv && cnv.elt) {
      const cnvCtx =
        typeof cnv.elt.getContext === "function"
          ? cnv.elt.getContext("2d", { willReadFrequently: true })
          : null;
      enforceCanvasSharpness(cnvCtx);
      cnv.elt.style.imageRendering = "pixelated";
    }
  } catch (e) {}

  if (
    typeof mapStates === "undefined" ||
    !mapStates ||
    mapStates.length === 0
  ) {
    return;
  }

  try {
    createMapImage();
  } catch (e) {
    console.warn("createMapImage failed", e);
  }
  redraw();
}

function createFullWindowCanvas() {
  W = windowWidth;
  H = windowHeight;
  createCanvas(W, H);
  pixelDensity(1);
}

function draw() {
  try {
    enforceCanvasSharpness(drawingContext);
  } catch (e) {}

  // Capture last frame's total draw calls, then reset for this frame.
  RenderStats.lastCount = RenderStats.drawImageCount;
  RenderStats.drawImageCount = 0;

  if (typeof PerfOverlay !== "undefined") PerfOverlay.beginFrame();

  // Clamp deltaTime to prevent huge jumps after lag/tab switch (see GameLoop).
  const _rawDelta = typeof deltaTime !== "undefined" ? deltaTime : FRAME_TIME_MS;
  gameDelta =
    typeof GameLoop !== "undefined"
      ? GameLoop.clampDelta(_rawDelta)
      : Math.min(_rawDelta, 50);

  if (typeof WeatherSystem !== "undefined" && SceneManager.isSimulating()) {
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
      overlayMessage = "Initializing World...";
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
      overlayMessage = "Roughening & Eroding...";
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

  if (typeof window !== "undefined" && !window.__gameDebugShown) {
    verboseLog("[game] draw() running");
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

  // World-space visible rect (+ padding) for viewport culling this frame.
  // virtualW/H are already in world units (W / gameScale), matching the
  // scale(gameScale) + translate(-drawCamX,-drawCamY) transform below.
  {
    const cullPad = cellSize * 2;
    viewLeft = drawCamX - cullPad;
    viewTop = drawCamY - cullPad;
    viewRight = drawCamX + virtualW + cullPad;
    viewBottom = drawCamY + virtualH + cullPad;
  }

  background(34, 139, 34);

  // START WORLD TRANSFORM
  push();
  // Apply Screen Shake inside camera transform
  if (screenShakeTimer > 0 && screenShakeEnabled) {
    translate(
      random(-screenShakeAmount, screenShakeAmount),
      random(-screenShakeAmount, screenShakeAmount),
    );
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

    if (SceneManager.isSimulating()) {
      if (typeof PerfOverlay !== "undefined") PerfOverlay.markUpdateStart();
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
        const d = dist(
          playerPosition.x,
          playerPosition.y,
          portalPos.x,
          portalPos.y,
        );
        if (d < 0.8) {
          verboseLog("[game] Entered Portal! Generating next map.");
          isPortalActive = false;
          victoryShown = false;
          generateMap(); // Create a whole new world
          try {
            showToast(t("world_cleared"), "info", 3500);
          } catch (e) {}
        }
      }
      if (typeof PerfOverlay !== "undefined") PerfOverlay.markUpdateEnd();
    }
  }

  if (typeof PerfOverlay !== "undefined") PerfOverlay.markRenderStart();

  if (typeof Renderer !== "undefined") Renderer.drawWorld();

  drawClouds();

  if (EDGE_LAYER_DEBUG && edgeLayer && logicalW && logicalH) {
    noStroke();
    fill(255, 0, 0, 100);
    for (let y = 0; y < logicalH; y++) {
      for (let x = 0; x < logicalW; x++) {
        if (edgeLayer[y * logicalW + x])
          rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  if (typeof Renderer !== "undefined")
    Renderer.drawNightOverlay(drawCamX, drawCamY);

  pop(); // END WORLD TRANSFORM

  if (_rawDelta > 0) {
    recordPerformanceSample(performanceTracker, 1000 / _rawDelta);
  }

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
    if (typeof WeatherSystem !== "undefined") {
      const vW = virtualW || width / gameScale;
      WeatherSystem.drawClock(vW - 60, 40, 25);
    }
  }

  if (performanceOverlayEnabled) {
    drawHudPerformanceOverlay();
  }

  // Dev-only perf overlay (?debug=1 / ?renderstats=1). Off in production.
  if (typeof PerfOverlay !== "undefined") {
    PerfOverlay.draw(
      virtualW || width / gameScale,
      virtualH || height / gameScale,
    );
  }

  try {
    if (typeof drawInGameMenu === "function") drawInGameMenu();
  } catch (e) {}

  // Clouds keep drifting even on game-over (no isGameOver gate), only paused
  // by an open overlay.
  if (!SceneManager.isOverlayOpen()) updateClouds();

  if (showTutorialsSetting) {
    handleTutorialLogic();
    drawTutorial();
  }

  pop(); // End Top level Push

  drawVignette();

  // Roll input edge-latches at frame end so wasPressed/wasReleased report
  // presses/releases that happened during this frame.
  if (typeof InputState !== "undefined") InputState.endFrame();
}

// game-core.js — p5.js lifecycle: setup, draw, windowResized, resize helpers
// Extracted from 4-Game.js

// Map-generation phase IDs stored in `genPhase`
const GENPHASE_START = 1; // show loading overlay, set initial message
const GENPHASE_PART1 = 2; // wait one frame, then run generateMap_Part1
const GENPHASE_PART2 = 3; // wait for heavy work, then run generateMap_Part2

// Player bounding-box height relative to cellSize (used for tree-fade overlap test)
const PLAYER_BBOX_HEIGHT_SCALE = 1.25;

// Tracks previous simulation state to detect pause→resume edge for perf-tracker reset.
let _wasSimulating = null;
const _missingHudHookWarnings = new Set();

// Continuously samples the raw browser rAF rate — independent of any FPS cap.
// Runs a lightweight parallel rAF loop that never renders.
const BrowserRafSampler = {
  fps: 0,
  avgDeltaMs: 16.67,
  _samples: [],
  _lastTime: null,
  _active: false,

  start: function () {
    if (this._active) return;
    this._active = true;
    this._lastTime = performance.now();
    requestAnimationFrame(this._tick.bind(this));
  },

  _tick: function (now) {
    if (!this._active) return;
    const delta = now - this._lastTime;
    this._lastTime = now;
    if (delta > 0 && delta < 500) {
      this._samples.push(delta);
      if (this._samples.length > 120) this._samples.shift();
      if (this._samples.length >= 10) {
        this.avgDeltaMs = this._samples.reduce((a, b) => a + b, 0) / this._samples.length;
        this.fps = 1000 / this.avgDeltaMs;
      }
    }
    requestAnimationFrame(this._tick.bind(this));
  },
};

function callHudHook(hookName, opts = {}) {
  const hook =
    (typeof window !== "undefined" && typeof window[hookName] === "function")
      ? window[hookName]
      : (typeof globalThis !== "undefined" && typeof globalThis[hookName] === "function")
        ? globalThis[hookName]
        : null;

  if (hook) {
    return hook();
  }

  if (!opts.optional && !_missingHudHookWarnings.has(hookName)) {
    _missingHudHookWarnings.add(hookName);
    console.warn(`[game] HUD hook missing: ${hookName}`);
  }
  return undefined;
}

// Per-frame callback registered with Pixi ticker for Pixi backend.
// Replaces p5's rAF-driven draw loop when RENDER_BACKEND === 'pixi'.
function _pixiGameTick() {
  const ticker = PixiApp.app.ticker;
  const periodMs = ticker.elapsedMS; // ms since last tick (Pixi's wall-clock measurement)

  // Set p5 globals so draw() sees correct delta and frame counter.
  window.deltaTime = Math.min(periodMs, 50); // spiral-of-death clamp
  window.frameCount = (window.frameCount || 0) + 1;

  const workStart = performance.now();
  try { draw(); } catch (e) { console.error('[pixi-tick] draw() threw:', e); }
  const workMs = performance.now() - workStart;

  window._gameFramePeriodMs = periodMs;
  window._gameFrameWorkMs   = workMs;
  window._gameFrameWaitMs   = Math.max(0, periodMs - workMs);
}

function setup() {
  verboseLog(
    "!!! NEW VERSION LOADED !!! - FIXED_VIRTUAL_HEIGHT = " +
      FIXED_VIRTUAL_HEIGHT,
  );

  // Initialize procedural sprites
  healthPotionSprite = createPotionGraphics([255, 50, 50]); // Red Potion
  powerupPotionSprite = createSpeedPotionGraphics(); // Speed Potion
  chestSprite = createChestGraphics();

  const viewportSize = getViewportSize();
  W = viewportSize.width;
  H = viewportSize.height;

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

  applyGameFpsMode(targetFps, "setup");

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        if (typeof resetPerformanceTracker === "function")
          resetPerformanceTracker(performanceTracker);
        if (typeof FramePerf !== "undefined") FramePerf.reset();
        if (typeof GameLoop !== "undefined") GameLoop.reset();
      }
    });
  }

  pixelDensity(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY));

  gameScale = H / FIXED_VIRTUAL_HEIGHT;
  virtualW = W / gameScale;
  virtualH = H / gameScale;

  let cnv = createCanvas(W, H);
  console.log('[game] setup: canvas created', W, 'x', H);

  // PixiJS WebGL layer — creates its own canvas behind the p5 canvas.
  // Must run after createCanvas so gameScale / W / H are known.
  if (RENDER_BACKEND === 'pixi' && typeof PixiApp !== 'undefined') {
    PixiApp.init({ width: W, height: H });
    // Make the p5 canvas a transparent overlay so the Pixi terrain shows through.
    if (cnv && cnv.elt) {
      cnv.elt.style.background = 'transparent';
      cnv.elt.style.position = 'absolute';
      cnv.elt.style.inset = '0';
    }
    // Hand frame-pacing to the Pixi ticker. p5's rAF loop is stopped;
    // _pixiGameTick calls draw() on every ticker frame.
    noLoop();
    PixiApp.app.ticker.add(_pixiGameTick);
    PixiApp.app.ticker.start();
  }

  // Persistent browser rAF diagnostic sampler — runs regardless of backend.
  BrowserRafSampler.start();

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

  applyGameFpsMode(targetFps, "setup");

  if (gameMusic) gameMusic.setVolume(musicVol * masterVol);
  if (pendingGameActivated) {
    try {
      _confirmResize();
      pendingGameActivated = false;
    } catch (e) {}
  }

  // Tell the parent menu that the game is fully initialised and ready for game-activated.
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'game-ready' }, '*');
      console.log('[game] posted game-ready to parent');
    }
  } catch (e) {}

}

function windowResized() {
  try {
    clearTimeout(_resizeConfirmTimer);
  } catch (e) {}
  const viewportSize = getViewportSize();
  _lastRequestedSize = { w: viewportSize.width, h: viewportSize.height };
  _resizeConfirmTimer = setTimeout(() => {
    const latestViewportSize = getViewportSize();
    if (
      _lastRequestedSize.w === latestViewportSize.width &&
      _lastRequestedSize.h === latestViewportSize.height
    ) {
      _confirmResize();
    } else {
      windowResized();
    }
  }, 200);
}

function _confirmResize() {
  _resizeConfirmTimer = null;

  const viewportSize = getViewportSize();
  W = viewportSize.width;
  H = viewportSize.height;

  pixelDensity(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY));

  // Use fixed virtual height for consistent zoom and exact viewport fill.
  gameScale = Math.max(0.001, H / FIXED_VIRTUAL_HEIGHT);
  virtualW = W / gameScale;
  virtualH = H / gameScale;

  const mapW = (logicalW || 0) * cellSize;
  const mapH = (logicalH || 0) * cellSize;
  if (mapW <= 0 || mapH <= 0) {
    resizeCanvas(W, H);
    try { noSmooth(); } catch (e) {}
    return;
  }

  resizeCanvas(W, H);

  if (RENDER_BACKEND === 'pixi' && typeof PixiApp !== 'undefined') {
    PixiApp.resize(W, H);
  }

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

  redraw();
}

function createFullWindowCanvas() {
  const viewportSize = getViewportSize();
  W = viewportSize.width;
  H = viewportSize.height;
  createCanvas(W, H);
  pixelDensity(1);
}

function draw() {
  if (typeof FramePerf !== "undefined") FramePerf.beginFrame();

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

  if (typeof FramePerf !== "undefined") FramePerf.start("update");

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
      if (typeof FramePerf !== "undefined") FramePerf.endFrame();
      return;
    }
    if (genPhase === GENPHASE_PART1) {
      background(0);
      if (millis() < genTimer) {
        if (typeof FramePerf !== "undefined") FramePerf.endFrame();
        return;
      }
      generateMap_Part1();
      overlayMessage = "Roughening & Eroding...";
      updateLoadingOverlayDom();
      genTimer = millis() + 800;
      genPhase = GENPHASE_PART2;
      if (typeof FramePerf !== "undefined") FramePerf.endFrame();
      return;
    }
    if (genPhase === GENPHASE_PART2) {
      background(0);
      if (millis() < genTimer) {
        if (typeof FramePerf !== "undefined") FramePerf.endFrame();
        return;
      }
      generateMap_Part2();
      genPhase = 0;
      showLoadingOverlay = false;
      completeLoadingProgress();
      updateLoadingOverlayDom();
      if (typeof resetPerformanceTracker === "function")
        resetPerformanceTracker(performanceTracker);
      if (typeof FramePerf !== "undefined") FramePerf.reset();
    }
  }

  if (typeof window !== "undefined" && !window.__gameDebugShown) {
    verboseLog("[game] draw() running");
    window.__gameDebugShown = true;
  }

  if (showLoadingOverlay || genPhase) {
    try {
      ensureLoadingOverlayDom();
      updateLoadingOverlayDom();
    } catch (e) {}
  }

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

    // Optional camera lead in movement direction
    let leadX = 0;
    let leadY = 0;
    if (isMoving && typeof CAMERA_LEAD_FACTOR !== "undefined" && CAMERA_LEAD_FACTOR > 0) {
      const dx = renderTargetX - renderStartX;
      const dy = renderTargetY - renderStartY;
      const len = Math.hypot(dx, dy) || 1;
      leadX = (dx / len) * CAMERA_LEAD_FACTOR * cellSize;
      leadY = (dy / len) * CAMERA_LEAD_FACTOR * cellSize;
    }

    const playerPixelX = pX * cellSize + cellSize / 2 + leadX;
    const playerPixelY = pY * cellSize + cellSize / 2 + leadY;

    targetCamX = playerPixelX - virtualW / 2;
    targetCamY = playerPixelY - virtualH / 2;
  }

  // Camera Smoothing
  const smoothT = typeof CAMERA_FOLLOW_SMOOTHING !== "undefined" ? CAMERA_FOLLOW_SMOOTHING : 0.12;
  if (smoothCamX === null || smoothCamY === null) {
    smoothCamX = targetCamX;
    smoothCamY = targetCamY;
  } else {
    // Adaptive smoothing based on frame time (normalized to ~60fps / 16.67ms)
    const t = 1 - Math.pow(1 - smoothT, gameDelta / 16.67);
    smoothCamX = lerp(smoothCamX, targetCamX, t);
    smoothCamY = lerp(smoothCamY, targetCamY, t);
  }

  // Clamp camera to world bounds AFTER smoothing
  if (mapW > virtualW) {
    smoothCamX = Math.max(0, Math.min(smoothCamX, mapW - virtualW));
  } else {
    smoothCamX = -(virtualW - mapW) / 2;
  }

  if (mapH > virtualH) {
    smoothCamY = Math.max(0, Math.min(smoothCamY, mapH - virtualH));
  } else {
    smoothCamY = -(virtualH - mapH) / 2;
  }

  // Unrounded float camera coordinates to allow smooth sub-pixel camera translation
  const drawCamX = smoothCamX;
  const drawCamY = smoothCamY;

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

  // In Pixi mode, clear to transparent so the WebGL terrain canvas shows through.
  if (RENDER_BACKEND === 'pixi' && typeof PixiApp !== 'undefined' && PixiApp.app) {
    clear();
  } else {
    background(34, 139, 34);
  }

  // START WORLD TRANSFORM
  push();
  // Extract shake offset so it can be applied to both the p5 canvas and the Pixi
  // world container in sync (avoiding terrain/entity misalignment during shake).
  let _frameShakeX = 0, _frameShakeY = 0;
  if (screenShakeTimer > 0 && screenShakeEnabled) {
    _frameShakeX = random(-screenShakeAmount, screenShakeAmount);
    _frameShakeY = random(-screenShakeAmount, screenShakeAmount);
    translate(_frameShakeX, _frameShakeY);
    screenShakeTimer -= gameDelta;
  } else if (screenShakeTimer > 0) {
    // Still decrement the timer even if visually disabled so logic completes
    screenShakeTimer -= gameDelta;
  }

  // Update Pixi world camera (same shake offsets for terrain/entity alignment)
  if (RENDER_BACKEND === 'pixi' && typeof PixiWorldRenderer !== 'undefined') {
    PixiWorldRenderer.update(drawCamX, drawCamY, _frameShakeX, _frameShakeY);
  }

  translate(-drawCamX, -drawCamY);

  if (typeof FramePerf !== "undefined") FramePerf.start("world");
  // Pixi mode: terrain is rendered on the WebGL canvas by PixiWorldRenderer.
  if (RENDER_BACKEND !== 'pixi') {
    if (typeof TerrainChunkCache !== "undefined") {
      TerrainChunkCache.drawVisible();
    } else if (mapImage) {
      image(mapImage, 0, 0);
    }
  }

  if (showLoadingOverlay) {
    if (typeof FramePerf !== "undefined") FramePerf.endFrame();
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
      if (typeof FramePerf !== "undefined") FramePerf.start("update");
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

  if (typeof FramePerf !== "undefined") FramePerf.start("entity");
  if (typeof Renderer !== "undefined") Renderer.drawWorld();

  if (typeof FramePerf !== "undefined") FramePerf.start("weather");
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
  if (typeof FramePerf !== "undefined") FramePerf.end();

  // Feed overlay from FramePerf — same EMA source as console [perf] logs.
  if (typeof FramePerf !== "undefined" && typeof performanceTracker !== "undefined") {
    const _nowSim = SceneManager.isSimulating();

    // Pause→resume edge: flush paused frames from the rolling window.
    if (_wasSimulating === false && _nowSim) {
      resetPerformanceTracker(performanceTracker);
      FramePerf.reset();
    }
    _wasSimulating = _nowSim;
    performanceTracker.paused = !_nowSim;

    if (_nowSim) {
      const snap = FramePerf.snapshot();
      if (snap && snap.fps > 0) {
        recordPerformanceSample(performanceTracker, snap.fps);
        performanceTracker.totalMs    = snap.totalMs;
        performanceTracker.updateMs   = snap.updateMs;
        performanceTracker.worldMs    = snap.worldMs;
        performanceTracker.entityMs   = snap.entityMs;
        performanceTracker.weatherMs  = snap.weatherMs;
        performanceTracker.hudMs      = snap.hudMs;
        performanceTracker.minimapMs  = snap.minimapMs;
        performanceTracker.pixiFlushMs   = snap.pixiFlushMs;
        performanceTracker.backend        = snap.backend;
        performanceTracker.browserRafFps  = snap.browserRafFps;
        performanceTracker.periodMs       = snap.periodMs;
        performanceTracker.workMs         = snap.workMs;
        performanceTracker.waitMs         = snap.waitMs;
      }
    }
  }

  // --- HUD --- (safe-area layout handled in game-hud.js)
  if (hudEnabled) {
    if (typeof FramePerf !== "undefined") FramePerf.start("hud");
    callHudHook("drawBottomHud");
    callHudHook("drawLeftHud");
    callHudHook("drawBossHud");
    callHudHook("drawCompass");
    callHudHook("drawDifficultyBadge");
    callHudHook("drawHudWeatherClock", { optional: true });

    if (showMinimap) {
      if (typeof FramePerf !== "undefined") FramePerf.start("minimap");
      callHudHook("drawMinimap");
    }
  }

  if (performanceOverlayEnabled) {
    if (typeof FramePerf !== "undefined") FramePerf.start("perfPanel");
    callHudHook("drawHudPerformanceOverlay");
  }

  // Dev-only perf overlay (?debug=1 / ?renderstats=1). Off in production.
  if (typeof PerfOverlay !== "undefined") {
    PerfOverlay.draw(
      virtualW || width / gameScale,
      virtualH || height / gameScale,
    );
  }
  if (typeof FramePerf !== "undefined") FramePerf.end();

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

  // Pixi entity sprites (overlay/decor/coin/portal) — update after Renderer.drawWorld()
  // has built currentDrawables, and before PixiApp.render() flushes the GPU frame.
  if (RENDER_BACKEND === 'pixi' && typeof PixiEntityRenderer !== 'undefined') {
    PixiEntityRenderer.update();
  }

  // Flush the Pixi WebGL frame (terrain + entity sprites).
  if (RENDER_BACKEND === 'pixi' && typeof PixiApp !== 'undefined' && PixiApp.app) {
    if (typeof FramePerf !== 'undefined') FramePerf.start('pixiFlush');
    PixiApp.render();
  }

  // Roll input edge-latches at frame end so wasPressed/wasReleased report
  // presses/releases that happened during this frame.
  if (typeof InputState !== "undefined") InputState.endFrame();
  if (typeof FramePerf !== "undefined") FramePerf.endFrame();
}

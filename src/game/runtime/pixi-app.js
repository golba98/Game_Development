// runtime/pixi-app.js — PixiJS WebGL application layer.
//
// Creates a PIXI.Application for GPU-accelerated rendering. The Pixi canvas
// sits behind the p5 canvas in the DOM (DOM order = stacking order). p5 draws
// entities/HUD/weather on a transparent front canvas; Pixi draws the terrain
// on the rear WebGL canvas. Both canvases fill #game-root absolutely.
//
// Pixi's auto-ticker is stopped on init — p5's draw() drives all frame pacing
// so FPS settings (60/120/Unlimited via applyGameFpsMode) apply to both.
// A single PixiApp.render() call at the end of each draw() flushes the GPU.

const PixiApp = {
  app: null,

  // Container hierarchy (stable for game lifetime after init)
  worldContainer: null,     // Camera transform: scale(gameScale) + translate(-cam)
  terrainContainer: null,   // child of world — the terrain sprite
  entityContainer: null,    // child of world — overlay/decor/coin/portal sprites
  overlayContainer: null,   // screen-space — reserved for future weather migration
  hudContainer: null,       // screen-space — reserved for future HUD migration
  minimapContainer: null,   // screen-space — reserved for future minimap migration

  _initialized: false,

  init: function ({ width, height }) {
    if (this._initialized || typeof PIXI === 'undefined') return;
    this._initialized = true;

    // Pixel-art nearest-neighbour scaling (set before any textures are created)
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    PIXI.settings.ROUND_PIXELS = typeof PIXI_ROUND_PIXELS !== 'undefined' ? PIXI_ROUND_PIXELS : true;

    this.app = new PIXI.Application({
      width,
      height,
      antialias: false,
      backgroundColor: 0x228B22,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
    });

    // Ticker starts paused; game-core.js starts it after registering _pixiGameTick.
    // Do NOT call ticker.start() here — the game loop callback must be added first.

    // Inject the Pixi canvas as the first child of #game-root so p5's canvas
    // (appended later by adoptCanvas) lands on top in DOM stacking order.
    const view = this.app.view;
    view.id = 'pixi-canvas';
    view.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%!important',
      'height:100%!important',
      'image-rendering:pixelated',
      'display:block',
    ].join(';');

    const root = document.getElementById('game-root');
    if (root) root.insertBefore(view, root.firstChild);

    // WebGL context loss/restore — rebuild terrain texture after restore
    view.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[PixiApp] WebGL context lost');
    });
    view.addEventListener('webglcontextrestored', () => {
      console.warn('[PixiApp] WebGL context restored — rebuilding textures');
      try { PixiWorldRenderer.rebuildTerrainTexture(); } catch (ex) {}
    });

    // Build container tree
    this.worldContainer    = new PIXI.Container();
    this.terrainContainer  = new PIXI.Container();
    this.entityContainer   = new PIXI.Container();
    this.entityContainer.sortableChildren = true;
    this.overlayContainer  = new PIXI.Container();
    this.hudContainer      = new PIXI.Container();
    this.minimapContainer  = new PIXI.Container();

    this.worldContainer.addChild(this.terrainContainer);
    this.worldContainer.addChild(this.entityContainer);

    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.overlayContainer);
    this.app.stage.addChild(this.hudContainer);
    this.app.stage.addChild(this.minimapContainer);
  },

  // Set Pixi ticker FPS cap. 0 = uncapped (Unlimited mode). Call from applyGameFpsMode.
  setTargetFps: function (fps) {
    if (!this.app || !this.app.ticker) return;
    this.app.ticker.maxFPS = (fps > 0 && fps < 10000) ? fps : 0;
  },

  // Flush the WebGL frame — called from inside draw() on both p5 and Pixi backends.
  render: function () {
    if (this.app) this.app.renderer.render(this.app.stage);
  },

  // Handle canvas resize (call from _confirmResize in game-core.js).
  resize: function (w, h) {
    if (this.app) this.app.renderer.resize(w, h);
  },

  // Apply camera + shake to worldContainer.
  // drawCamX/Y: virtual world-pixel camera offset (0..mapPixelW).
  // scale: gameScale (maps virtual pixels to canvas pixels).
  // shakeX/Y: optional per-frame screen-shake offset in virtual pixels.
  setWorldCamera: function (drawCamX, drawCamY, scale, shakeX, shakeY) {
    if (!this.worldContainer) return;
    const sx = shakeX || 0;
    const sy = shakeY || 0;
    this.worldContainer.scale.set(scale);
    this.worldContainer.position.set(
      (-drawCamX + sx) * scale,
      (-drawCamY + sy) * scale,
    );
  },
};

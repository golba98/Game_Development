// runtime/pixi-minimap-renderer.js — Minimap Pixi layer (future migration stub).
//
// Minimap currently renders on the p5 canvas overlay via drawMinimap() in
// game-hud.js. This module holds PixiApp.minimapContainer and tracks the
// _mapDirty flag so game-world.js can signal when terrain changes.
//
// Future implementation will use a PIXI.RenderTexture (baked at map load,
// updated at ~10 Hz for enemy/coin dots) to avoid per-frame Canvas2D compositing.

const PixiMinimapRenderer = {
  _mapDirty: false,
  _initialized: false,

  init: function () {
    if (this._initialized || !PixiApp.app) return;
    this._initialized = true;
    // minimapContainer is available at PixiApp.minimapContainer for future use
  },

  update: function () {
    // No-op until minimap rendering is migrated from p5 canvas to Pixi
    this._mapDirty = false;
  },
};

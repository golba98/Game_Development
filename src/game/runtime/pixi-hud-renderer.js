// runtime/pixi-hud-renderer.js — HUD Pixi layer (future migration stub).
//
// HUD elements (health/mana/XP bars, compass, minimap panel) currently render
// on the transparent p5 canvas overlay in game-core.js. This module holds the
// PixiApp.hudContainer ready for incremental migration in a follow-up PR.
//
// When a HUD element is migrated here, it should:
//   - Create PIXI.Graphics / PIXI.Text objects once in init()
//   - Use dirty flags to rebuild only when values change (not every frame)
//   - Read positions from getHudLayout() — the virtual-coord layout system is
//     unchanged; all positions are already in virtual screen space

const PixiHudRenderer = {
  _initialized: false,

  init: function () {
    if (this._initialized || !PixiApp.app) return;
    this._initialized = true;
    // hudContainer is available at PixiApp.hudContainer for future use
  },

  update: function () {
    // No-op until HUD elements are migrated from p5 canvas to Pixi
  },
};

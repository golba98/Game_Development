// runtime/pixi-weather-renderer.js — Weather/night overlay Pixi layer (future stub).
//
// The night overlay (darkness mask + light holes + stars + ambient particles)
// currently renders on the p5 canvas overlay via WeatherSystem.drawOverlay() +
// Renderer.drawNightOverlay(). Those calls happen on the transparent p5 canvas,
// so the darkness mask correctly composites over the Pixi terrain behind it.
//
// This module holds PixiApp.overlayContainer for future GPU migration:
//   - Darkness mask  → PIXI.Graphics fullscreen rect, alpha from WeatherSystem.currentColor
//   - Light holes    → PIXI.RenderTexture composite with PIXI.BLEND_MODES.ERASE
//   - Stars          → PIXI.ParticleContainer (500 sprites, twinkle at 20 Hz)
//   - Particles      → pooled PIXI.Graphics circles (ambient fireflies/dust)

const PixiWeatherRenderer = {
  _initialized: false,

  init: function () {
    if (this._initialized || !PixiApp.app) return;
    this._initialized = true;
    // overlayContainer is available at PixiApp.overlayContainer for future use
  },

  update: function (_camX, _camY) {
    // No-op until weather overlay is migrated from p5 canvas to Pixi
  },
};

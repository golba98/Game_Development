// runtime/pixi-world-renderer.js — Terrain rendering via WebGL sprite.
//
// The full mapImage (p5.Graphics baked terrain) is uploaded once as a single
// PIXI.Sprite and drawn each frame with one GPU blit. This replaces the
// TerrainChunkCache path which issued 40+ Canvas2D drawImage calls per frame
// (one per 512×512 chunk visible on screen) — the primary CPU bottleneck.
//
// API:
//   rebuildTerrainTexture()              call after createMapImage() completes
//   invalidate()                         call after drawTileToMap() changes a tile
//   update(camX, camY, shakeX, shakeY)   call each frame to apply camera transform

const PixiWorldRenderer = {
  _terrainSprite: null,

  // Upload the current mapImage canvas as a Pixi texture.
  // mapImage is a p5.Graphics; its underlying HTMLCanvasElement is at mapImage.elt.
  rebuildTerrainTexture: function () {
    if (!PixiApp.app) return;
    if (typeof mapImage === 'undefined' || !mapImage) return;

    // Destroy previous sprite + texture to free GPU memory
    if (this._terrainSprite) {
      try {
        this._terrainSprite.texture.destroy(true);
        PixiApp.terrainContainer.removeChild(this._terrainSprite);
        this._terrainSprite.destroy({ children: true });
      } catch (e) {}
      this._terrainSprite = null;
    }

    // p5.Graphics.elt is the underlying HTMLCanvasElement
    const srcCanvas = mapImage.elt ||
      (mapImage.drawingContext && mapImage.drawingContext.canvas);
    if (!srcCanvas) {
      console.warn('[PixiWorldRenderer] mapImage canvas not accessible');
      return;
    }

    const tex = PIXI.Texture.from(srcCanvas);
    this._terrainSprite = new PIXI.Sprite(tex);
    this._terrainSprite.position.set(0, 0);
    PixiApp.terrainContainer.addChild(this._terrainSprite);

    console.info('[PixiWorldRenderer] terrain texture uploaded',
      srcCanvas.width, 'x', srcCanvas.height);
  },

  // Mark the terrain BaseTexture dirty after a single-tile update.
  // Triggers a GPU re-upload on the next render call.
  invalidate: function () {
    if (this._terrainSprite && this._terrainSprite.texture &&
        this._terrainSprite.texture.baseTexture) {
      try {
        this._terrainSprite.texture.baseTexture.update();
      } catch (e) {}
    }
  },

  // Apply camera transform to worldContainer each frame.
  // shakeX/Y are the same random offsets applied to p5's translate() this frame
  // so both canvases shake in sync.
  update: function (drawCamX, drawCamY, shakeX, shakeY) {
    if (!PixiApp.app) return;
    PixiApp.setWorldCamera(
      drawCamX,
      drawCamY,
      typeof gameScale !== 'undefined' ? gameScale : 1,
      shakeX || 0,
      shakeY || 0,
    );
  },
};

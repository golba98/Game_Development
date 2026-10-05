// Bounded terrain textures work on GPUs that cannot upload the full 4800px map.
const PixiWorldRenderer = {
  _chunks: [],

  clear: function () {
    for (const chunk of this._chunks) {
      if (chunk.sprite.parent) chunk.sprite.parent.removeChild(chunk.sprite);
      chunk.sprite.destroy({ texture: true, baseTexture: true });
      chunk.canvas.width = chunk.canvas.height = 0;
    }
    this._chunks.length = 0;
  },

  rebuildTerrainTexture: function () {
    if (!PixiApp.app || !mapImage) return;
    const source = mapImage.elt || (mapImage.drawingContext && mapImage.drawingContext.canvas);
    if (!source) throw new Error('Terrain canvas unavailable');
    this.clear();
    const gl = PixiApp.app.renderer.gl;
    const limit = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 2048;
    if (!Number.isFinite(limit) || limit < 1) throw new Error('Invalid GPU texture limit');
    const size = Math.min(2048, limit);
    try {
      for (let y = 0; y < source.height; y += size) {
        for (let x = 0; x < source.width; x += size) {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(size, source.width - x);
          canvas.height = Math.min(size, source.height - y);
          const context = canvas.getContext('2d');
          context.imageSmoothingEnabled = false;
          context.drawImage(source, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
          const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
          sprite.position.set(x, y);
          PixiApp.terrainContainer.addChild(sprite);
          this._chunks.push({ x, y, canvas, sprite });
        }
      }
    } catch (error) {
      this.clear();
      throw error;
    }
  },

  invalidate: function (x = 0, y = 0, width = Infinity, height = Infinity) {
    if (!mapImage) return;
    const source = mapImage.elt || (mapImage.drawingContext && mapImage.drawingContext.canvas);
    for (const chunk of this._chunks) {
      if (chunk.x >= x + width || chunk.y >= y + height ||
          chunk.x + chunk.canvas.width <= x || chunk.y + chunk.canvas.height <= y) continue;
      const context = chunk.canvas.getContext('2d');
      context.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height);
      context.drawImage(source, chunk.x, chunk.y, chunk.canvas.width, chunk.canvas.height,
        0, 0, chunk.canvas.width, chunk.canvas.height);
      chunk.sprite.texture.baseTexture.update();
    }
  },

  update: function (drawCamX, drawCamY, shakeX, shakeY) {
    if (!PixiApp.app) return;
    PixiApp.setWorldCamera(drawCamX, drawCamY, gameScale, shakeX || 0, shakeY || 0);
  },
};

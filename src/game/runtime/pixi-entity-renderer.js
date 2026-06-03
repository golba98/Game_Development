// runtime/pixi-entity-renderer.js — Entity sprite rendering via PixiJS.
//
// Renders static-asset entity types (overlays, decor, coins, portal) as pooled
// Pixi sprites in worldContainer. Player, enemies, VFX, and projectiles still
// render via entity.draw() on the transparent p5 canvas overlay (see game-core.js).
//
// When RENDER_BACKEND === 'pixi', Renderer.drawWorld() skips drawing these types
// to the p5 canvas so they are not double-rendered.
//
// Reads currentDrawables[] (sorted by baseY) built by Renderer.drawWorld() each
// frame. Call update() after Renderer.drawWorld() and before PixiApp.render().

const PixiEntityRenderer = {
  // Reusable sprite pool (grows as needed, never shrinks)
  _spritePool: [],

  // Cached textures keyed by HTMLElement reference for deduplication
  _texCache: new Map(),

  // Animated frame textures for coins (4 frames) and portal (6 frames)
  _coinFrames: null,
  _portalActiveFrames: null,
  _portalInactiveFrames: null,

  // Player bounding rect (module-level scratch, matches renderer.js _pRect)
  _pRect: { x: 0, y: 0, w: 0, h: 0 },

  _getTexture: function (imgObj) {
    if (!imgObj) return PIXI.Texture.EMPTY;
    const elt = imgObj.elt ||
      (imgObj.drawingContext && imgObj.drawingContext.canvas);
    if (!elt) return PIXI.Texture.EMPTY;
    let tex = this._texCache.get(elt);
    if (!tex) {
      tex = PIXI.Texture.from(elt);
      this._texCache.set(elt, tex);
    }
    return tex;
  },

  _acquireSprite: function () {
    return this._spritePool.length > 0 ? this._spritePool.pop() : new PIXI.Sprite();
  },

  _releaseAll: function () {
    const ec = PixiApp.entityContainer;
    while (ec.children.length > 0) {
      const s = ec.removeChildAt(0);
      s.visible = false;
      s.blendMode = PIXI.BLEND_MODES.NORMAL;
      this._spritePool.push(s);
    }
  },

  _ensureCoinFrames: function () {
    if (this._coinFrames) return;
    if (typeof coinAnimSprite === 'undefined' || !coinAnimSprite) return;
    const baseTex = this._getTexture(coinAnimSprite).baseTexture;
    if (!baseTex) return;
    const fw = Math.floor(baseTex.realWidth / 4);
    const fh = baseTex.realHeight;
    this._coinFrames = [0, 1, 2, 3].map(i =>
      new PIXI.Texture(baseTex, new PIXI.Rectangle(i * fw, 0, fw, fh)));
  },

  _ensurePortalFrames: function () {
    if (this._portalActiveFrames) return;
    const make = (imgObj, count) => {
      if (!imgObj) return null;
      const baseTex = this._getTexture(imgObj).baseTexture;
      if (!baseTex) return null;
      const fw = Math.floor(baseTex.realWidth / count);
      const fh = baseTex.realHeight;
      return Array.from({ length: count }, (_, i) =>
        new PIXI.Texture(baseTex, new PIXI.Rectangle(i * fw, 0, fw, fh)));
    };
    if (typeof portalActiveSheet !== 'undefined')
      this._portalActiveFrames = make(portalActiveSheet, 6);
    if (typeof portalInactiveSheet !== 'undefined')
      this._portalInactiveFrames = make(portalInactiveSheet, 6);
  },

  update: function () {
    if (!PixiApp.app || !PixiApp.entityContainer) return;
    if (typeof currentDrawables === 'undefined' || !currentDrawables) return;

    this._releaseAll();
    this._ensureCoinFrames();
    this._ensurePortalFrames();

    const now = typeof millis === 'function' ? millis() : Date.now();

    // Compute player bounding box for overlay alpha fade (same logic as renderer.js)
    let pRect = null;
    if (typeof playerPosition !== 'undefined' && playerPosition) {
      const pX = (typeof isMoving !== 'undefined' && isMoving &&
        typeof renderX !== 'undefined') ? renderX : playerPosition.x;
      const pY = (typeof isMoving !== 'undefined' && isMoving &&
        typeof renderY !== 'undefined') ? renderY : playerPosition.y;
      const pW = typeof cellSize !== 'undefined' ? cellSize : 32;
      const pH = pW * (typeof PLAYER_BBOX_HEIGHT_SCALE !== 'undefined'
        ? PLAYER_BBOX_HEIGHT_SCALE : 1.25);
      this._pRect.x = pX * pW + pW / 2 - pW / 2;
      this._pRect.y = pY * pW + pW - pH;
      this._pRect.w = pW;
      this._pRect.h = pH;
      pRect = this._pRect;
    }

    for (const d of currentDrawables) {
      let sprite = null;

      switch (d.type) {

        case 'overlay': {
          const o = d.o;
          if (!o) continue;
          let tex = PIXI.Texture.EMPTY;
          if (o.imgType === 'image' && o.img) {
            tex = this._getTexture(o.img);
          } else if (o.imgType === 'sheet' && typeof spritesheet !== 'undefined'
              && spritesheet && o.s) {
            const baseTex = this._getTexture(spritesheet).baseTexture;
            tex = new PIXI.Texture(baseTex,
              new PIXI.Rectangle(o.s.x, o.s.y, o.s.w, o.s.h));
          }
          if (tex === PIXI.Texture.EMPTY) continue;

          sprite = this._acquireSprite();
          sprite.texture = tex;
          sprite.position.set(d.drawX, d.drawY);
          sprite.width  = o.destW;
          sprite.height = o.destH;

          // Alpha fade when player is behind this overlay (matches renderer.js)
          let alpha = 1;
          if (pRect && d.baseY > pRect.y + pRect.h * 0.5) {
            if (pRect.x < d.drawX + o.destW &&
                pRect.x + pRect.w > d.drawX &&
                pRect.y < d.drawY + o.destH &&
                pRect.y + pRect.h > d.drawY) {
              alpha = 140 / 255;
            }
          }
          sprite.alpha  = alpha;
          sprite.zIndex = d.baseY;
          break;
        }

        case 'decor': {
          if (!d.img) continue;
          sprite = this._acquireSprite();
          sprite.texture = this._getTexture(d.img);
          sprite.position.set(d.drawX, d.drawY);
          sprite.width  = d.destW;
          sprite.height = d.destH;
          sprite.alpha  = 1;
          sprite.zIndex = d.baseY;
          break;
        }

        case 'coin': {
          if (!this._coinFrames) continue;
          const frame = Math.floor(now / 150) % 4;
          const drawSize = (typeof cellSize !== 'undefined' ? cellSize : 32) * 0.8;
          sprite = this._acquireSprite();
          sprite.texture = this._coinFrames[frame];
          sprite.position.set(
            d.tileX * (typeof cellSize !== 'undefined' ? cellSize : 32) +
              ((typeof cellSize !== 'undefined' ? cellSize : 32) - drawSize) / 2,
            d.tileY * (typeof cellSize !== 'undefined' ? cellSize : 32) +
              ((typeof cellSize !== 'undefined' ? cellSize : 32) - drawSize) / 2,
          );
          sprite.width  = drawSize;
          sprite.height = drawSize;
          sprite.alpha  = 1;
          sprite.zIndex = d.baseY;
          break;
        }

        case 'portal': {
          const frames = (typeof isPortalActive !== 'undefined' && isPortalActive)
            ? this._portalActiveFrames
            : this._portalInactiveFrames;
          if (!frames) continue;
          const cs = typeof cellSize !== 'undefined' ? cellSize : 32;
          const pFrame = Math.floor(now / 150) % 6;
          const drawSize = cs * 2.0;
          sprite = this._acquireSprite();
          sprite.texture = frames[pFrame];
          sprite.position.set(
            d.x * cs + (cs - drawSize) / 2,
            d.y * cs + (cs - drawSize),
          );
          sprite.width  = drawSize;
          sprite.height = drawSize;
          sprite.alpha  = 1;
          sprite.zIndex = d.baseY;
          break;
        }

        default:
          // player / enemy / vfx / projectile — rendered on the p5 canvas overlay
          continue;
      }

      if (sprite) {
        sprite.visible = true;
        PixiApp.entityContainer.addChild(sprite);
      }
    }
  },
};

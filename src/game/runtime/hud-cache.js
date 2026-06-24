// runtime/hud-cache.js — offscreen caching for static HUD content (the "HUD" layer).
//
// Most of the HUD is cheap vector drawing whose values change every frame
// (health, mana, XP, score) and is fine to redraw. The exception is the
// minimap: its terrain is already cached into `minimapImage`, but the tree
// markers — which never move — were re-stroked one circle at a time, every
// frame, for the whole forest. That static layer belongs in the cache too.
//
// HudCache owns baking static HUD content into offscreen buffers. It is rebuilt
// only when the underlying data changes (here: when the map is (re)generated),
// not per frame. Dynamic markers (player, enemies, coins, active portal) are
// still drawn live on top in game-hud.js.

const HudCache = {
  _minimapComposite: null,
  _minimapLastUpdate: 0,
  _minimapKey: "",
  _minimapDirty: true,
  MINIMAP_UPDATE_MS: 125,

  markMinimapDirty: function () {
    this._minimapDirty = true;
  },

  /**
   * Bake the static minimap markers (tree dots) into the minimap graphics
   * buffer `g`, in the buffer's native coordinate space. Called once from the
   * minimap-cache step of createMapImage(), so the per-frame minimap draw no
   * longer iterates every tree.
   *
   * @param {p5.Graphics} g     - the minimap buffer (minimapImage)
   * @param {number} drawW      - width the map was drawn into the buffer at
   * @param {number} drawH      - height the map was drawn into the buffer at
   */
  bakeMinimapStatics: function (g, drawW, drawH) {
    if (
      !g ||
      typeof treeObjects === "undefined" ||
      !treeObjects ||
      !logicalW ||
      !logicalH
    ) {
      return;
    }
    g.push();
    g.fill(15, 70, 15);
    g.stroke(0, 150);
    g.strokeWeight(1);
    for (const tr of treeObjects) {
      g.circle((tr.x / logicalW) * drawW, (tr.y / logicalH) * drawH, 4);
    }
    g.pop();
  },

  getMinimapComposite: function (opts) {
    if (!opts || !opts.mmW || !opts.mmH || !mapImage) return null;
    const now = typeof millis === "function" ? millis() : Date.now();
    const key = [
      opts.mmW,
      opts.mmH,
      Math.round(opts.drawW),
      Math.round(opts.drawH),
      Math.round(opts.offX),
      Math.round(opts.offY),
      logicalW || 0,
      logicalH || 0,
      isPortalActive ? 1 : 0,
      portalPos ? portalPos.x + ":" + portalPos.y : "none",
    ].join("|");

    if (
      this._minimapComposite &&
      !this._minimapDirty &&
      this._minimapKey === key &&
      now - this._minimapLastUpdate < this.MINIMAP_UPDATE_MS
    ) {
      return this._minimapComposite;
    }

    if (
      !this._minimapComposite ||
      this._minimapComposite.width !== opts.mmW ||
      this._minimapComposite.height !== opts.mmH
    ) {
      if (this._minimapComposite && typeof this._minimapComposite.remove === "function") {
        try {
          this._minimapComposite.remove();
        } catch (e) {}
      }
      this._minimapComposite = createGraphics(opts.mmW, opts.mmH);
      try {
        this._minimapComposite.pixelDensity(1);
        this._minimapComposite.noSmooth();
        enforceCanvasSharpness(this._minimapComposite.drawingContext);
      } catch (e) {}
      this._minimapDirty = true;
    }

    const g = this._minimapComposite;
    g.clear();
    g.push();
    g.tint(255, 230);
    if (minimapImage) {
      g.image(minimapImage, opts.offX, opts.offY, opts.drawW, opts.drawH);
    } else {
      g.image(mapImage, opts.offX, opts.offY, opts.drawW, opts.drawH);
      this.bakeMinimapStatics(g, opts.drawW, opts.drawH);
    }
    g.noTint();

    if (portalPos && logicalW && logicalH) {
      g.fill(isPortalActive ? 180 : 100, isPortalActive ? 50 : 100, isPortalActive ? 255 : 100);
      g.stroke(0, 150);
      g.strokeWeight(1);
      const px = opts.offX + (portalPos.x / logicalW) * opts.drawW;
      const py = opts.offY + (portalPos.y / logicalH) * opts.drawH;
      g.rect(px - 3, py - 3, 6, 6);
    }

    if (typeof enemies !== "undefined" && enemies && enemies.length > 0 && logicalW && logicalH) {
      g.fill(255, 50, 50);
      g.stroke(0, 150);
      g.strokeWeight(1);
      for (const e of enemies) {
        g.circle(opts.offX + (e.x / logicalW) * opts.drawW, opts.offY + (e.y / logicalH) * opts.drawH, 4);
      }
    }

    if (typeof activeCoins !== "undefined" && activeCoins && logicalW && logicalH) {
      g.fill(255, 215, 0);
      g.stroke(0, 150);
      g.strokeWeight(1);
      for (const coin of activeCoins) {
        g.circle(opts.offX + (coin.x / logicalW) * opts.drawW, opts.offY + (coin.y / logicalH) * opts.drawH, 3);
      }
    }
    g.pop();

    this._minimapKey = key;
    this._minimapLastUpdate = now;
    this._minimapDirty = false;
    return g;
  },
};

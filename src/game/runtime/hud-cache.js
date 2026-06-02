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
};

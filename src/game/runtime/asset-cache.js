// runtime/asset-cache.js — sprite/image caching (the "assets" layer).
//
// Image *loading* is already owned by AssetTracker + trackLoadImage in
// game-assets.js (each image is decoded once). What this layer owns is the
// per-size render cache: sprites are drawn at cellSize-derived sizes that almost
// never match the source resolution, so without a cache every image() call would
// make the GPU rescale on the fly. AssetCache.prescaled() renders each (image,
// size) pair into a buffer once and returns that buffer thereafter, turning the
// hot-path draw into a ~1:1 blit.
//
// getPrescaledImage() in game-assets.js is a thin alias to this, so existing
// callers (the renderer) are unchanged.

const AssetCache = {
  // image -> Map("<w>x<h>" -> prescaled buffer | source image fallback)
  _prescaled: new Map(),

  /** True if an image has finished loading and is safe to draw. */
  usable: function (img) {
    return !!(img && img.width && img.height);
  },

  /**
   * Return `img` pre-scaled to (w, h). Cached by image identity then size; sizes
   * are stable (cellSize-based) so the cache stays small. If building the buffer
   * fails — or the image isn't usable yet — the source image is returned AND
   * cached under that size, so a missing/odd asset can never trigger the
   * expensive createGraphics path again on later frames.
   */
  prescaled: function (img, w, h) {
    if (!this.usable(img)) return img;
    const rw = Math.max(1, Math.round(w));
    const rh = Math.max(1, Math.round(h));
    // Already native size — nothing to gain from caching.
    if (img.width === rw && img.height === rh) return img;

    let byImg = this._prescaled.get(img);
    if (!byImg) {
      byImg = new Map();
      this._prescaled.set(img, byImg);
    }
    const key = rw + "x" + rh;
    let buf = byImg.get(key);
    // A hit here is either the real prescaled buffer or the source-image fallback
    // cached after a prior failure — either way, no rebuild.
    if (buf) return buf;

    try {
      buf = createGraphics(rw, rh);
      buf.pixelDensity(1);
      enforceCanvasSharpness(buf.drawingContext);
      buf.clear();
      buf.image(img, 0, 0, rw, rh);
    } catch (e) {
      buf = img; // cache the source so we don't retry the failing build each frame
    }
    byImg.set(key, buf);
    return buf;
  },

  /** Drop a cached image's buffers (e.g. if a source image is freed/replaced). */
  invalidate: function (img) {
    this._prescaled.delete(img);
  },
};

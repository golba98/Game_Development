// runtime/perf-overlay.js — dev-only performance instrumentation overlay.
//
// Part of the layered game runtime. This is the "perf/debug" layer: it owns
// all profiling counters and the on-screen panel, so the rest of the runtime
// just reports numbers to it. It is OFF by default and adds near-zero cost
// when disabled — every hot-path call is guarded by `PerfOverlay.enabled`.
//
// Enable in dev with `?debug=1` (full panel) or `?renderstats=1` (legacy alias,
// also turns on the drawImage counter). Never auto-enabled in production builds.
//
// Metrics shown:
//   FPS                 — smoothed frames/second (p5 frameRate)
//   frame               — total frame time in ms (p5 deltaTime)
//   update              — game-logic update time (ms)
//   render              — render time, world + overlays + HUD (ms)
//   draws/f             — drawImage calls per frame (via RenderStats)
//   ents R/C            — entities rendered / culled this frame
//   parts               — particles (VFX) rendered this frame

const PerfOverlay = {
  enabled: false,

  // Per-frame counters (reset in beginFrame()).
  entitiesRendered: 0,
  entitiesCulled: 0,
  particlesRendered: 0,

  // Smoothed timing samples (ms). Rolling averages keep the panel readable.
  _fps: 0,
  _frameMs: 0,
  _updateMs: 0,
  _renderMs: 0,

  // Scratch timestamps.
  _updateStart: 0,
  _renderStart: 0,

  // Exponential-moving-average smoothing factor (0..1). Higher = snappier.
  _smooth: 0.1,

  /**
   * Read URL flags and arm the overlay. Call once from setup().
   * `?debug=1` enables the full panel; `?renderstats=1` is a legacy alias that
   * also flips on the drawImage counter (RenderStats).
   */
  init: function () {
    try {
      const params = new URLSearchParams(window.location.search);
      const debug = params.get("debug") === "1";
      const renderstats = params.get("renderstats") === "1";
      this.enabled = debug || renderstats;
      if (this.enabled && typeof RenderStats !== "undefined") {
        RenderStats.enabled = true; // ensure drawImage counting is live
      }
    } catch (e) {}
  },

  _now: function () {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  },

  _ema: function (prev, next) {
    return prev === 0 ? next : prev + (next - prev) * this._smooth;
  },

  /** Reset per-frame counters and sample frame-level timing. Call at top of draw(). */
  beginFrame: function () {
    if (!this.enabled) return;
    this.entitiesRendered = 0;
    this.entitiesCulled = 0;
    this.particlesRendered = 0;

    // p5 globals: deltaTime is last frame interval (ms), frameRate() is fps.
    if (typeof deltaTime !== "undefined") {
      this._frameMs = this._ema(this._frameMs, deltaTime);
    }
    if (typeof frameRate === "function") {
      this._fps = this._ema(this._fps, frameRate());
    }
  },

  markUpdateStart: function () {
    if (this.enabled) this._updateStart = this._now();
  },

  markUpdateEnd: function () {
    if (this.enabled) {
      this._updateMs = this._ema(this._updateMs, this._now() - this._updateStart);
    }
  },

  markRenderStart: function () {
    if (this.enabled) this._renderStart = this._now();
  },

  markRenderEnd: function () {
    if (this.enabled) {
      this._renderMs = this._ema(this._renderMs, this._now() - this._renderStart);
    }
  },

  /**
   * Record this frame's drawable counts. `candidates` is the total number of
   * world objects considered before culling; `rendered` is how many survived.
   */
  recordDrawables: function (candidates, rendered, particles) {
    if (!this.enabled) return;
    this.entitiesRendered = rendered;
    this.entitiesCulled = Math.max(0, candidates - rendered);
    this.particlesRendered = particles;
  },

  /**
   * Draw the panel. Call near the end of draw(), inside the scaled top-level
   * transform, passing the virtual screen size. Pins to the bottom-left so it
   * stays clear of the top HUD (bars, compass, FPS, clock).
   */
  draw: function (virtualScreenW, virtualScreenH) {
    if (!this.enabled) return;
    this.markRenderEnd();

    const draws =
      typeof RenderStats !== "undefined" ? RenderStats.lastCount : 0;

    const lines = [
      `FPS    ${Math.round(this._fps)}`,
      `frame  ${this._frameMs.toFixed(1)}ms`,
      `update ${this._updateMs.toFixed(2)}ms`,
      `render ${this._renderMs.toFixed(2)}ms`,
      `draws/f ${draws}`,
      `ents   ${this.entitiesRendered}R ${this.entitiesCulled}C`,
      `parts  ${this.particlesRendered}`,
    ];

    const w = 132;
    const lineH = 15;
    const h = lines.length * lineH + 10;
    const x = 10;
    const y =
      typeof virtualScreenH === "number" && virtualScreenH > 0
        ? virtualScreenH - h - 10
        : 80;

    push();
    noStroke();
    fill(0, 170);
    rect(x, y, w, h, 3);
    fill(120, 230, 120);
    textAlign(LEFT, CENTER);
    gTextSize(12);
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], x + 8, y + 10 + i * lineH);
    }
    pop();
  },
};

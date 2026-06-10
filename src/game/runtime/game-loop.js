// runtime/game-loop.js — frame pacing + delta-time helper.
//
// The "loop" layer of the runtime. p5.js owns the actual requestAnimationFrame
// callback (draw()), so this module does NOT replace it; instead it centralizes
// the two things a stable loop needs:
//
//   1. Delta clamping — cap per-frame dt so a tab-out or GC pause can't teleport
//      entities or blow up integration. Everything that delta-scales reads the
//      clamped value via gameDelta.
//
//   2. A fixed-step accumulator — optional fixed-timestep simulation with a hard
//      cap on catch-up steps, which is what prevents the "spiral of death" where
//      a slow frame schedules even more work and falls further behind.
//
// The FPS cap itself is a user setting (`targetFps`, Graphics > Max FPS) applied
// through applyFPS()/p5's frameRate(); this module only governs timing math.

const GameLoop = {
  // Largest dt we will report in a single frame (ms). 50ms == a 20fps floor:
  // below that the world stops integrating faster and simply runs in slow-mo
  // for one frame rather than jumping. Matches the prior inline clamp.
  MAX_FRAME_MS: 50,

  // Fixed simulation timestep (ms) for the accumulator path (Stage 8 sim).
  FIXED_STEP_MS: 1000 / 60,

  // Hard cap on fixed steps processed per frame. The spiral-of-death guard:
  // if we ever owe more than this, we drop the backlog instead of compounding.
  MAX_FIXED_STEPS: 5,

  _accumulator: 0,

  // Last clamped delta (ms), exposed for any caller that wants it.
  lastDelta: 1000 / 60,

  /**
   * Clamp a raw frame delta (ms) into a safe range and remember it.
   * Falls back to one fixed step if the input is missing/non-finite.
   */
  clampDelta: function (rawDelta) {
    const dt =
      typeof rawDelta === "number" && isFinite(rawDelta)
        ? rawDelta
        : this.FIXED_STEP_MS;
    this.lastDelta = Math.min(Math.max(dt, 0), this.MAX_FRAME_MS);
    return this.lastDelta;
  },

  /**
   * Feed a clamped delta into the fixed-step accumulator and return how many
   * fixed simulation steps should run this frame (0..MAX_FIXED_STEPS).
   * Drains any backlog beyond the cap so the loop can never spiral.
   */
  consumeFixedSteps: function (clampedDelta) {
    this._accumulator += clampedDelta;
    let steps = 0;
    while (
      this._accumulator >= this.FIXED_STEP_MS &&
      steps < this.MAX_FIXED_STEPS
    ) {
      this._accumulator -= this.FIXED_STEP_MS;
      steps++;
    }
    // Hit the cap with time still owed -> we're behind; drop it, don't compound.
    if (this._accumulator > this.FIXED_STEP_MS * this.MAX_FIXED_STEPS) {
      this._accumulator = 0;
    }
    return steps;
  },

  /** Interpolation factor (0..1) between the last and next fixed step. */
  alpha: function () {
    return this._accumulator / this.FIXED_STEP_MS;
  },

  /** Reset accumulated time, e.g. after a long load or map regen. */
  reset: function () {
    this._accumulator = 0;
  },
};

const FramePerf = {
  LOG_INTERVAL_MS: 2000,
  enabled: true,
  _frameStart: 0,
  _stageStart: 0,
  _currentStage: null,
  _lastLog: 0,
  _frames: 0,
  _sums: {
    totalMs: 0,
    updateMs: 0,
    worldMs: 0,
    entityMs: 0,
    weatherMs: 0,
    hudMs: 0,
    minimapMs: 0,
    perfPanelMs: 0,
    pixiFlushMs: 0,
  },

  _now: function () {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  },

  beginFrame: function () {
    if (!this.enabled) return;
    const now = this._now();
    this._frameStart = now;
    this._stageStart = now;
    this._currentStage = null;
  },

  start: function (stage) {
    if (!this.enabled) return;
    this.end();
    this._currentStage = stage;
    this._stageStart = this._now();
  },

  end: function () {
    if (!this.enabled || !this._currentStage) return;
    const now = this._now();
    const key = this._currentStage + "Ms";
    if (Object.prototype.hasOwnProperty.call(this._sums, key)) {
      this._sums[key] += now - this._stageStart;
    }
    this._currentStage = null;
    this._stageStart = now;
  },

  endFrame: function () {
    if (!this.enabled || !this._frameStart) return;
    this.end();
    const now = this._now();
    this._sums.totalMs += now - this._frameStart;
    this._frames++;
    if (!this._lastLog) this._lastLog = now;
    if (now - this._lastLog < this.LOG_INTERVAL_MS) return;

    const frames = Math.max(1, this._frames);
    const avg = (key) => Number((this._sums[key] / frames).toFixed(2));
    const fps =
      typeof frameRate === "function"
        ? Math.round(frameRate())
        : Math.round(1000 / Math.max(1, avg("totalMs")));
    const perfObj = {
      fps,
      backend: typeof RENDER_BACKEND !== 'undefined' ? RENDER_BACKEND : 'p5',
      totalMs: avg("totalMs"),
      updateMs: avg("updateMs"),
      worldMs: avg("worldMs"),
      entityMs: avg("entityMs"),
      weatherMs: avg("weatherMs"),
      hudMs: avg("hudMs"),
      minimapMs: avg("minimapMs"),
      perfPanelMs: avg("perfPanelMs"),
    };
    if (typeof RENDER_BACKEND !== 'undefined' && RENDER_BACKEND === 'pixi') {
      perfObj.pixiFlushMs = avg("pixiFlushMs");
    }
    console.info("[perf] frame", perfObj);

    this._frames = 0;
    this._lastLog = now;
    for (const key in this._sums) this._sums[key] = 0;
  },

  snapshot: function () {
    const frames = Math.max(1, this._frames);
    const avg = (key) => (this._sums[key] ? this._sums[key] / frames : 0);

    // For Pixi backend: use ticker.FPS (wall-clock rate) instead of p5.frameRate().
    let fps;
    if (typeof RENDER_BACKEND !== 'undefined' && RENDER_BACKEND === 'pixi'
        && typeof PixiApp !== 'undefined' && PixiApp.app && PixiApp.app.ticker) {
      fps = PixiApp.app.ticker.FPS;
    } else if (typeof frameRate === 'function') {
      fps = frameRate();
    } else {
      fps = this._sums.totalMs > 0 ? 1000 / (this._sums.totalMs / frames) : 0;
    }

    const browserRafFps =
      typeof BrowserRafSampler !== 'undefined' ? BrowserRafSampler.fps : fps;

    return {
      fps,
      browserRafFps,
      periodMs: typeof window._gameFramePeriodMs !== 'undefined' ? window._gameFramePeriodMs : avg('totalMs'),
      workMs:   typeof window._gameFrameWorkMs   !== 'undefined' ? window._gameFrameWorkMs   : avg('totalMs'),
      waitMs:   typeof window._gameFrameWaitMs   !== 'undefined' ? window._gameFrameWaitMs   : 0,
      totalMs:     avg("totalMs"),
      updateMs:    avg("updateMs"),
      worldMs:     avg("worldMs"),
      entityMs:    avg("entityMs"),
      weatherMs:   avg("weatherMs"),
      hudMs:       avg("hudMs"),
      minimapMs:   avg("minimapMs"),
      pixiFlushMs: avg("pixiFlushMs"),
      backend: typeof RENDER_BACKEND !== "undefined" ? RENDER_BACKEND : "p5",
    };
  },

  reset: function () {
    this._frames = 0;
    this._lastLog = 0;
    for (const key in this._sums) this._sums[key] = 0;
  },
};

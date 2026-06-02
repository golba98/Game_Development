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

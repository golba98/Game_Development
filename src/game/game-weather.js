// --- Day/Night Cycle Phase Boundaries (0–1 fraction of full cycle) ---
const CYCLE_NIGHT_END = 0.2; // Night ends; dawn begins
const CYCLE_DAWN_MID = 0.25; // Dawn transitions from night→dawn to dawn→day
const CYCLE_DAY_START = 0.3; // Day begins (dawn ends)
const CYCLE_DAY_END = 0.6; // Day ends; dusk begins
const CYCLE_DUSK_MID = 0.75; // Dusk transitions from day→dusk to dusk→night
const CYCLE_NIGHT_START = 0.9; // Night resumes (dusk ends)

// --- Star Rendering Constants ---
const STAR_VISIBILITY_MIN_ALPHA = 60; // Overlay alpha below which stars are hidden
const STAR_VISIBILITY_SCALE = 80; // Alpha range over which stars fade in
const STAR_GLOW_ALPHA_FACTOR = 0.25; // Halo opacity as fraction of core alpha
const STAR_GLOW_MIN_SIZE = 3; // Minimum star size that can have a glow halo
const STAR_GLOW_PROB = 0.6; // Probability a large star gets a glow halo
const STAR_SEED = 54321;

const WeatherSystem = {
  // Config
  dayDurationSeconds: 480, // Gives the player time to perceive each lighting stage
  cycle: CYCLE_DAY_START, // Start at full day to avoid initial "orange" filter
  timeTransition: null,

  // Colors (r, g, b, alpha) — restrained ambient tints viewed at ground level
  colors: {
    night: [6, 10, 24, 218], // Moonlit blue-black; retains terrain detail
    dawn: [118, 137, 166, 38], // Cool pre-dawn light
    day: [0, 0, 0, 0], // Clear (no overlay)
    sunset: [72, 38, 24, 48], // Low, warm evening light without an orange wash
    dusk: [24, 31, 58, 126], // Blue hour between sunset and full night
  },

  currentColor: [0, 0, 0, 0],
  lightMap: null,

  // --- Star System ---
  stars: [],
  starsGenerated: false,
  STAR_COUNT: 500,
  STAR_FIELD_SIZE: 4000,
  PARALLAX_FACTOR: 1.0, // Stars fixed to world coordinates (1:1 with camera)
  STAR_DRIFT_SPEED: 0, // No drift, perfectly static
  starTime: 0,

  particles: [],
  _warmLightStamps: Object.create(null),

  // --- Performance caches ---
  _nativeMapCtx: null,          // Cached 2D context for the darkness map (avoid getContext every frame)
  _overlayFillStyle: null,      // Cached fillStyle string for darkness base fill
  _overlayFillColor: null,      // [r,g,b,a] snapshot when _overlayFillStyle was built
  _starColorStrings: null,      // Pre-built rgba strings: [colorIdx][alphaInt 0-255]
  _starTwinkleTime: -Infinity,  // starTime value when _cachedTwinkle was last computed
  _TWINKLE_UPDATE_INTERVAL: 0.05, // Recompute twinkle every 50 ms (~20 Hz)

  // Star color palette for natural variety
  STAR_COLORS: [
    [255, 255, 255], // Pure white
    [255, 255, 255], // Pure white (more common)
    [200, 220, 255], // Cool blue-white
    [180, 200, 255], // Blue
    [255, 240, 220], // Warm white
    [255, 220, 180], // Warm yellow-white
    [255, 200, 200], // Faint reddish
  ],

  /** Park-Miller LCG: returns a deterministic PRNG seeded by `seed`. */
  _seededRandom: function (seed) {
    let s = seed;
    return function () {
      // Multiplier 16807 (7^5), modulus 2147483647 (2^31 - 1, Mersenne prime)
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  },

  /** Populates `this.stars` with deterministically placed, sized, and coloured stars. */
  generateStars: function () {
    this.stars = [];
    const rng = this._seededRandom(STAR_SEED);
    const fieldSize = this.STAR_FIELD_SIZE;

    // Distribute stars evenly across a grid, then jitter within each cell
    const cols = Math.ceil(Math.sqrt(this.STAR_COUNT));
    const rows = Math.ceil(this.STAR_COUNT / cols);
    const cellW = fieldSize / cols;
    const cellH = fieldSize / rows;

    let count = 0;
    for (let row = 0; row < rows && count < this.STAR_COUNT; row++) {
      for (let col = 0; col < cols && count < this.STAR_COUNT; col++) {
        const x = (col + rng()) * cellW;
        const y = (row + rng()) * cellH;

        // 55% small, 25% medium, 20% large
        const sizeRoll = rng();
        const _starSize = sizeRoll < 0.55 ? 2 : sizeRoll < 0.8 ? 3 : 4;

        // Multi-frequency twinkle for natural look
        const twinkleSpeed1 = 1.0 + rng() * 2.5; // Primary oscillation
        const twinkleSpeed2 = 3.0 + rng() * 4.0; // Secondary faster flicker
        const twinklePhase1 = rng() * Math.PI * 2;
        const twinklePhase2 = rng() * Math.PI * 2;
        const twinkleDepth = 0.3 + rng() * 0.5; // Dim range (0.3 = subtle, 0.8 = dramatic)

        const colorIdx = Math.floor(rng() * this.STAR_COLORS.length);
        const color = this.STAR_COLORS[colorIdx];

        const hasGlow = _starSize >= STAR_GLOW_MIN_SIZE && rng() < STAR_GLOW_PROB;

        this.stars.push({
          x,
          y,
          size: _starSize,
          color,
          _colorIdx: colorIdx,
          hasGlow,
          twinkleSpeed1,
          twinkleSpeed2,
          twinklePhase1,
          twinklePhase2,
          twinkleDepth,
          _cachedTwinkle: 1.0,
        });
        count++;
      }
    }
    this.starsGenerated = true;
  },

  /** Pre-builds rgba string lookup table: _starColorStrings[colorIdx][alphaInt 0-255]. */
  _buildStarColorStrings: function () {
    this._starColorStrings = new Array(this.STAR_COLORS.length);
    for (let ci = 0; ci < this.STAR_COLORS.length; ci++) {
      const [r, g, b] = this.STAR_COLORS[ci];
      const row = new Array(256);
      for (let a = 0; a < 256; a++) {
        row[a] = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
      }
      this._starColorStrings[ci] = row;
    }
  },

  /** Draws the star field onto the given 2D context, scaled by current darkness alpha. */
  drawStars: function (ctx, w, h, darknessAlpha, camX, camY) {
    if (darknessAlpha < STAR_VISIBILITY_MIN_ALPHA) return;

    if (!this.starsGenerated) this.generateStars();
    if (!this._starColorStrings) this._buildStarColorStrings();

    // Star visibility scales with darkness
    const starOpacity = Math.min(
      1.0,
      (darknessAlpha - STAR_VISIBILITY_MIN_ALPHA) / STAR_VISIBILITY_SCALE,
    );
    const time = this.starTime;
    const fieldSize = this.STAR_FIELD_SIZE;

    const driftX = time * this.STAR_DRIFT_SPEED;
    const driftY = time * (this.STAR_DRIFT_SPEED * 0.2);

    const offsetX = (camX || 0) * this.PARALLAX_FACTOR + driftX;
    const offsetY = (camY || 0) * this.PARALLAX_FACTOR + driftY;

    // Throttle twinkle recompute to ~20 Hz — imperceptible above 12 Hz visually.
    if (time - this._starTwinkleTime >= this._TWINKLE_UPDATE_INTERVAL) {
      this._starTwinkleTime = time;
      for (const star of this.stars) {
        const wave1 = Math.sin(time * star.twinkleSpeed1 + star.twinklePhase1);
        const wave2 = Math.sin(time * star.twinkleSpeed2 + star.twinklePhase2);
        star._cachedTwinkle =
          1.0 -
          star.twinkleDepth *
            (0.6 * (0.5 + 0.5 * wave1) + 0.4 * (0.5 + 0.5 * wave2));
      }
    }

    const colorStrings = this._starColorStrings;

    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // Additive blending so stars glow on darkness

    for (let si = 0; si < this.stars.length; si++) {
      const star = this.stars[si];

      const sx = (((star.x - offsetX) % fieldSize) + fieldSize) % fieldSize;
      const sy = (((star.y - offsetY) % fieldSize) + fieldSize) % fieldSize;

      if (sx > w + 10 || sy > h + 10 || sx < -10 || sy < -10) continue;

      const twinkle = star._cachedTwinkle !== undefined ? star._cachedTwinkle : 1.0;
      const alpha = starOpacity * twinkle;
      const colorIdx = star._colorIdx !== undefined ? star._colorIdx : 0;
      const px = Math.floor(sx + (camX || 0));
      const py = Math.floor(sy + (camY || 0));

      if (star.hasGlow) {
        const glowAlphaInt = Math.min(255, (alpha * STAR_GLOW_ALPHA_FACTOR * 255) | 0);
        ctx.fillStyle = colorStrings[colorIdx][glowAlphaInt];
        ctx.fillRect(px - 1, py - 1, star.size + 2, star.size + 2);
      }

      const alphaInt = Math.min(255, (alpha * 255) | 0);
      ctx.fillStyle = colorStrings[colorIdx][alphaInt];
      ctx.fillRect(px, py, star.size, star.size);
    }
    ctx.restore();
  },

  /** Advances the day/night cycle by `dt` ms and recalculates the overlay colour. */
  update: function (dt) {
    if (this.timeTransition) {
      const transition = this.timeTransition;
      transition.elapsed = Math.min(transition.duration, transition.elapsed + dt);
      const progress = this.easeInOutSine(transition.elapsed / transition.duration);
      this.cycle = (transition.start + transition.distance * progress) % 1.0;
      if (transition.elapsed >= transition.duration) this.timeTransition = null;
    } else {
      const increment = dt / 1000 / this.dayDurationSeconds;
      this.cycle = (this.cycle + increment) % 1.0;
    }
    this.starTime += dt / 1000;
    this.calculateColor();
  },

  // Moves forward through the real dawn/dusk phases instead of snapping the
  // world to a new lighting state. Used by the terminal time command.
  transitionTo: function (targetCycle, durationMs = 24000) {
    const target = ((Number(targetCycle) % 1) + 1) % 1;
    const distance = (target - this.cycle + 1) % 1;
    if (distance < 0.0001) return;
    this.timeTransition = {
      start: this.cycle,
      distance,
      elapsed: 0,
      duration: Math.max(1000, Number(durationMs) || 24000),
    };
  },

  /** Returns the named phase used by gameplay events and transition UI. */
  getPhase: function () {
    const t = this.cycle;
    if (t < CYCLE_NIGHT_END || t >= CYCLE_NIGHT_START) return 'night';
    if (t < CYCLE_DAY_START) return 'dawn';
    if (t < CYCLE_DAY_END) return 'day';
    return 'dusk';
  },

  /** Resets the cycle to the start of day and clears the light map. */
  reset: function () {
    this.cycle = CYCLE_DAY_START;
    this.timeTransition = null;
    this.starTime = 0;
    this.calculateColor();
    if (this.lightMap) this.lightMap.clear();
  },

  /** Provide a smooth ease-in-out Sine interpolation algorithm for butter-smooth visual fading. */
  easeInOutSine: function (t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  },

  /** Shared 0–1 darkness curve used by the overlay, torch, and night effects. */
  getDarknessProgress: function () {
    const nightAlpha = Math.max(1, this.colors.night[3]);
    const linear = Math.max(0, Math.min(1, this.currentColor[3] / nightAlpha));
    return linear * linear * (3 - 2 * linear);
  },

  /**
   * Returns the player torch light radius based on the current cycle.
   * During full day the radius is huge (effectively no visible circle).
   * During dusk it smoothly shrinks. At night it is at its smallest.
   * During dawn it smoothly grows back.
   */
  getLightRadius: function () {
    const DAY_RADIUS = 520;
    const NIGHT_RADIUS = 230;
    return DAY_RADIUS + (NIGHT_RADIUS - DAY_RADIUS) * this.getDarknessProgress();
  },

  /**
   * Maps the current cycle fraction to an RGBA overlay colour natively.
   * Cycle phases:
   *   [0, NIGHT_END)       → night
   *   [NIGHT_END, DAY_START) → dawn (night→dawn→day crossfade)
   *   [DAY_START, DAY_END)   → day
   *   [DAY_END, NIGHT_START) → dusk (day→sunset→dusk→night crossfade)
   *   [NIGHT_START, 1)     → night
   */
  calculateColor: function () {
    const t = this.cycle;

    if (t < CYCLE_NIGHT_END) {
      // Full night
      this.currentColor = [...this.colors.night];
    } else if (t < CYCLE_DAY_START) {
      // Dawn crossfade: night → dawn → day
      if (t < CYCLE_DAWN_MID) {
        let lerpT = (t - CYCLE_NIGHT_END) / (CYCLE_DAWN_MID - CYCLE_NIGHT_END);
        this.currentColor = this.lerpColor(
          this.colors.night,
          this.colors.dawn,
          this.easeInOutSine(lerpT),
        );
      } else {
        let lerpT = (t - CYCLE_DAWN_MID) / (CYCLE_DAY_START - CYCLE_DAWN_MID);
        this.currentColor = this.lerpColor(
          this.colors.dawn,
          this.colors.day,
          this.easeInOutSine(lerpT),
        );
      }
    } else if (t < CYCLE_DAY_END) {
      // Full day
      this.currentColor = [...this.colors.day];
    } else if (t < CYCLE_NIGHT_START) {
      // Dusk crossfade: day → sunset → dusk → night

      // We will slice the day->night region (0.60 to 0.90) into three equal segments
      const segmentDur = (CYCLE_NIGHT_START - CYCLE_DAY_END) / 3;
      const sunsetStart = CYCLE_DAY_END;
      const duskStart = sunsetStart + segmentDur;
      const nightStart = duskStart + segmentDur;

      if (t < duskStart) {
        // Segment 1: Day (clear) to Sunset (amber/pink)
        let lerpT = (t - sunsetStart) / segmentDur;
        this.currentColor = this.lerpColor(
          this.colors.day,
          this.colors.sunset,
          this.easeInOutSine(lerpT),
        );
      } else if (t < nightStart) {
        // Segment 2: Sunset to Dusk (Deep blue)
        let lerpT = (t - duskStart) / segmentDur;
        this.currentColor = this.lerpColor(
          this.colors.sunset,
          this.colors.dusk,
          this.easeInOutSine(lerpT),
        );
      } else {
        // Segment 3: Dusk to Night (Almost black)
        let lerpT = (t - nightStart) / segmentDur;
        this.currentColor = this.lerpColor(
          this.colors.dusk,
          this.colors.night,
          this.easeInOutSine(lerpT),
        );
      }
    } else {
      // Full night
      this.currentColor = [...this.colors.night];
    }
  },

  /** Linear interpolation between two RGBA colour arrays based on smoothing factor 't' */
  lerpColor: function (c1, c2, t) {
    return [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t,
      c1[3] + (c2[3] - c1[3]) * t,
    ];
  },

  /**
   * Returns a cached radial-falloff sprite (white→transparent alpha) used to
   * carve light holes out of the darkness mask via destination-out. Built once;
   * it is resolution-independent because drawOverlay scales it per light. The
   * 0.1 inner-radius matches the previous per-light gradient's hard core.
   */
  _getLightStamp: function () {
    if (this._lightStamp) return this._lightStamp;
    const S = 128;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(
      S / 2,
      S / 2,
      (S / 2) * 0.1,
      S / 2,
      S / 2,
      S / 2,
    );
    grd.addColorStop(0, "rgba(0,0,0,1)"); // Fully erase at center
    grd.addColorStop(1, "rgba(0,0,0,0)"); // Fade out at edges
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    this._lightStamp = c;
    return c;
  },

  _getWarmLightStamp: function (color) {
    const rgb = Array.isArray(color) ? color.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v)))) : [255, 174, 76];
    const key = rgb.join(',');
    if (this._warmLightStamps[key]) return this._warmLightStamps[key];
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`);
    gradient.addColorStop(0.28, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.22)`);
    gradient.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    this._warmLightStamps[key] = canvas;
    return canvas;
  },

  /**
   * Draws the darkness overlay and light halos onto the main canvas.
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   * @param {Array}  lights - Screen-space light sources: {x, y, radius, r, g, b, intensity}
   * @param {number} camX - Camera world X (for star parallax)
   * @param {number} camY - Camera world Y (for star parallax)
   */
  drawOverlay: function (w, h, lights, camX, camY) {
    if (this.currentColor[3] < 5) return;

    // We keep a native resolution map for the darkness mask. It's much cheaper
    // to draw a low-res black box and punch low-res holes in it, then scale it up.
    const DOWNSCALE = 4;
    const cw = Math.ceil(w / DOWNSCALE);
    const ch = Math.ceil(h / DOWNSCALE);

    // Initialize or resize the native darkness map
    if (
      !this.nativeMap ||
      this.nativeMap.width !== cw ||
      this.nativeMap.height !== ch
    ) {
      if (this.nativeMap) this.nativeMap.width = this.nativeMap.height = 0; // Help GC
      this.nativeMap = document.createElement("canvas");
      this.nativeMap.width = cw;
      this.nativeMap.height = ch;
      // No willReadFrequently — keeps the canvas GPU-accelerated (matches main canvas policy).
      this._nativeMapCtx = this.nativeMap.getContext("2d");
      this._overlayFillStyle = null; // Invalidate cached fillStyle on resize
    }

    const ctx = this._nativeMapCtx;

    // 1. Fill entire screen with darkness — rebuild fillStyle string only when color changes.
    const cc = this.currentColor;
    if (
      !this._overlayFillColor ||
      this._overlayFillColor[0] !== cc[0] ||
      this._overlayFillColor[1] !== cc[1] ||
      this._overlayFillColor[2] !== cc[2] ||
      this._overlayFillColor[3] !== cc[3]
    ) {
      this._overlayFillStyle = `rgba(${cc[0]}, ${cc[1]}, ${cc[2]}, ${(cc[3] / 255).toFixed(4)})`;
      this._overlayFillColor = [cc[0], cc[1], cc[2], cc[3]];
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this._overlayFillStyle;
    ctx.fillRect(0, 0, cw, ch);

    // 2. Erase holes for dynamic lights.
    // Every light shares the same soft radial falloff, so instead of building a
    // fresh createRadialGradient per light per frame (expensive — it was the
    // hottest part of the night overlay), we punch each hole by stamping a single
    // pre-rendered gradient sprite, scaled to the light's radius via drawImage.
    if (lights && lights.length > 0) {
      ctx.globalCompositeOperation = "destination-out";
      const stamp = this._getLightStamp();
      for (const l of lights) {
        // Scale down light positions and radiuses to match the mini-buffer
        const lx = l.x / DOWNSCALE;
        const ly = l.y / DOWNSCALE;
        const rad = (l.radius || 100) / DOWNSCALE;
        ctx.globalAlpha = Math.max(0, Math.min(1, Number(l.eraseStrength) || 0.3));
        ctx.drawImage(stamp, lx - rad, ly - rad, rad * 2, rad * 2);
      }
      ctx.globalAlpha = 1;
    }

    // Restore P5 transform and draw the native mask scaled up
    push();
    drawingContext.save();

    // Smooth upscaling for the shadow mask
    drawingContext.imageSmoothingEnabled = true;

    // Draw darkness mask slightly larger than the screen to hide screen-shake edges or floating point map borders
    const overscan = 100;
    drawingContext.drawImage(
      this.nativeMap,
      camX - overscan / 2,
      camY - overscan / 2,
      w + overscan,
      h + overscan,
    );

    // Warm colour is added after darkness, so the torch reads as firelight
    // instead of a circular hole revealing daytime terrain.
    if (lights && lights.length > 0) {
      drawingContext.globalCompositeOperation = 'screen';
      for (const light of lights) {
        if (!light.color || (Number(light.intensity) || 0) <= 0) continue;
        const radius = Number(light.radius) || 100;
        drawingContext.globalAlpha = Math.max(0, Math.min(1, Number(light.intensity) || 0.35));
        const warmStamp = this._getWarmLightStamp(light.color);
        const drawX = (camX || 0) + light.x - radius;
        const drawY = (camY || 0) + light.y - radius;
        drawingContext.drawImage(warmStamp, drawX, drawY, radius * 2, radius * 2);
      }
      drawingContext.globalAlpha = 1;
      drawingContext.globalCompositeOperation = 'source-over';
    }

    // Draw stars OVER the darkness mask so they aren't masked out by the 90% opacity black
    if (showStars && this.currentColor[3] >= STAR_VISIBILITY_MIN_ALPHA) {
      this.drawStars(drawingContext, w, h, this.currentColor[3], camX, camY);
    }

    drawingContext.restore();
    pop();
  },

  /** Returns an [r, g, b, a] tint for clouds based on current ambient darkness. */
  getCloudTint: function () {
    const alpha = this.currentColor[3];
    const brightness = map(alpha, 0, 200, 255, 40); // Darken clouds significantly at night

    // Mix in ambient colour for coloured moonlight/dusklight tinting
    const r = map(this.currentColor[0], 0, 255, 255, 100);
    const g = map(this.currentColor[1], 0, 255, 255, 100);
    const b = map(this.currentColor[2], 0, 255, 255, 120);

    return [
      Math.min(r, brightness),
      Math.min(g, brightness),
      Math.min(b, brightness),
      240,
    ];
  },

  /** Draws a pixel-art clock widget centred at (x, y) with the given radius. */
  drawClock: function (x, y, radius) {
    push();
    translate(x, y);
    rectMode(CENTER);

    const _clockSize = radius * 2;

    // --- 1. Outer Square Frame (Pixel-Themed Bronze) ---
    noStroke();
    fill(0, 120);
    rect(2, 2, _clockSize + 10, _clockSize + 10, 4); // Drop shadow

    stroke(50, 40, 30);
    strokeWeight(3);
    fill(35, 30, 25); // Dark metallic backing
    rect(0, 0, _clockSize + 6, _clockSize + 6, 2);

    stroke(180, 150, 50); // Inner gold inlay
    strokeWeight(1.5);
    noFill();
    rect(0, 0, _clockSize + 2, _clockSize + 2, 1);

    // Corner rivets (mechanical pixel look)
    fill(100, 90, 80);
    noStroke();
    const off = _clockSize / 2 + 1;
    rect(-off, -off, 4, 4);
    rect(off, -off, 4, 4);
    rect(off, off, 4, 4);
    rect(-off, off, 4, 4);

    // --- 2. Quilted Background ---
    push();
    drawingContext.beginPath();
    drawingContext.rect(-_clockSize / 2, -_clockSize / 2, _clockSize, _clockSize);
    drawingContext.clip();

    stroke(45, 40, 35, 150);
    strokeWeight(1);
    const step = 10;
    for (let i = -_clockSize; i < _clockSize; i += step) {
      line(i, -_clockSize, i + _clockSize, _clockSize);
      line(i + _clockSize, -_clockSize, i, _clockSize);
    }

    // --- 3. Sky Strip (Rotates behind the frame) ---
    const skyRotation = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
    push();
    rotate(skyRotation);
    noStroke();
    fill(40, 100, 220, 100); // Day half
    arc(0, 0, _clockSize * 1.5, _clockSize * 1.5, PI, TWO_PI);
    fill(10, 10, 40, 140); // Night half
    arc(0, 0, _clockSize * 1.5, _clockSize * 1.5, 0, PI);
    pop();

    pop(); // End clipping

    // --- 4. Celestial Icons ---
    const iconDist = radius - 6;
    const sunAngle = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
    const moonAngle = sunAngle + PI;

    // Sun
    push();
    translate(cos(sunAngle) * iconDist, sin(sunAngle) * iconDist);
    noStroke();
    fill(255, 200, 50, 80);
    circle(0, 0, 16); // Sun glow
    fill(255, 255, 200);
    rect(0, 0, 10, 10); // Square sun core
    stroke(255, 215, 0, 200);
    strokeWeight(2);
    for (let i = 0; i < 4; i++) {
      rotate(PI / 2);
      const rLen = 9 + sin(millis() * 0.005 + i) * 2;
      line(0, 6, 0, rLen);
    }
    pop();

    // Moon
    push();
    translate(cos(moonAngle) * iconDist, sin(moonAngle) * iconDist);
    noStroke();
    fill(150, 180, 255, 40);
    rect(0, 0, 14, 14, 2); // Moon glow
    fill(220, 230, 255);
    rect(0, 0, 10, 10, 1); // Moon body
    fill(30, 25, 20);
    rect(4, -3, 8, 8, 1); // Crescent mask
    pop();

    // --- 5. Glass Reflection ---
    noStroke();
    fill(255, 30);
    triangle(-radius, -radius, radius, -radius, -radius, radius);

    // --- 6. Top Indicator Gem ---
    fill(255, 215, 0);
    noStroke();
    rect(0, -radius - 4, 6, 6);

    pop();
  },

  /** Renders a small, frame-rate-independent pool of dust or nighttime fireflies. */
  drawAmbientParticles: function (camX, camY, darknessProgress) {
    if (!showParticles || typeof width === "undefined") {
      this.particles.length = 0;
      return;
    }

    const vW = typeof virtualW !== "undefined" ? virtualW : width / gameScale;
    const vH = typeof virtualH !== "undefined" ? virtualH : height / gameScale;

    const nightMix = Math.max(0, Math.min(1, Number(darknessProgress) || 0));
    const isNight = nightMix >= 0.55;
    const kind = isNight ? 'firefly' : 'dust';
    const cap = isNight ? 12 : 18;
    if (this.particles.length !== cap || this.particles.some(p => p.kind !== kind)) {
      this.particles.length = 0;
      for (let i = 0; i < cap; i++) {
        const angle = Math.random() * TWO_PI;
        const speed = isNight ? 3 + Math.random() * 5 : 2 + Math.random() * 4;
        this.particles.push({
          kind,
          x: Math.random() * 2000,
          y: Math.random() * 2000,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 2.5 + 1,
          phase: Math.random() * TWO_PI,
          phaseSpeed: 0.8 + Math.random() * 1.2,
          _visible: false,
        });
      }
    }

    push();
    noStroke();

    // Particles move independently of time but drift with wind and slow camera parallax
    const offsetX = (camX || 0) * 0.8;
    const offsetY = (camY || 0) * 0.8;

    const dtSeconds = Math.max(0, Math.min(0.05, (Number(gameDelta) || 0) / 1000));
    for (const p of this.particles) {
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.phase += p.phaseSpeed * dtSeconds;

      const wrapScale = 2000;
      if (p.x < 0) p.x += wrapScale;
      if (p.x > wrapScale) p.x -= wrapScale;
      if (p.y < 0) p.y += wrapScale;
      if (p.y > wrapScale) p.y -= wrapScale;

      const screenX = (((p.x - offsetX) % wrapScale) + wrapScale) % wrapScale;
      const screenY = (((p.y - offsetY) % wrapScale) + wrapScale) % wrapScale;
      p._screenX = screenX;
      p._screenY = screenY;
      p._visible = false;

      if (
        screenX > -10 &&
        screenX < vW + 10 &&
        screenY > -10 &&
        screenY < vH + 10
      ) {
        p._visible = true;
        const pulse = (Math.sin(p.phase) + 1) / 2;
        const drawX = screenX + (camX || 0);
        const drawY = screenY + (camY || 0);

        if (isNight) {
          const fadeIn = Math.max(0, Math.min(1, (nightMix - 0.55) / 0.45));
          const alpha = (50 + pulse * 150) * fadeIn;
          fill(214, 238, 112, alpha);
          circle(drawX, drawY, p.size);
          fill(190, 222, 92, alpha * 0.18);
          circle(drawX, drawY, p.size * 2.4);
        } else {
          const alpha = 20 + pulse * 60;
          fill(255, 250, 220, alpha);
          circle(drawX, drawY, p.size);
        }
      }
    }
    pop();
  },

  getAmbientLights: function () {
    const darknessProgress = this.getDarknessProgress();
    if (!showParticles || !showFireflyLighting || darknessProgress < 0.55) return [];
    const fadeIn = Math.max(0, Math.min(1, (darknessProgress - 0.55) / 0.45));
    const result = [];
    for (const particle of this.particles) {
      if (!particle._visible || particle.kind !== 'firefly') continue;
      result.push({
        type: 'firefly',
        x: particle._screenX,
        y: particle._screenY,
        radius: 34,
        color: [190, 220, 90],
        intensity: 0.18 * fadeIn,
        eraseStrength: 0.12 * fadeIn,
      });
      if (result.length === 3) break;
    }
    return result;
  },
};

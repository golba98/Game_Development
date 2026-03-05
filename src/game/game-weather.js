
// --- Day/Night Cycle Phase Boundaries (0–1 fraction of full cycle) ---
const CYCLE_NIGHT_END    = 0.20; // Night ends; dawn begins
const CYCLE_DAWN_MID     = 0.25; // Dawn transitions from night→dawn to dawn→day
const CYCLE_DAY_START    = 0.30; // Day begins (dawn ends)
const CYCLE_DAY_END      = 0.60; // Day ends; dusk begins
const CYCLE_DUSK_MID     = 0.75; // Dusk transitions from day→dusk to dusk→night
const CYCLE_NIGHT_START  = 0.90; // Night resumes (dusk ends)

// --- Star Rendering Constants ---
const STAR_VISIBILITY_MIN_ALPHA = 60;   // Overlay alpha below which stars are hidden
const STAR_VISIBILITY_SCALE     = 80;   // Alpha range over which stars fade in
const STAR_GLOW_ALPHA_FACTOR    = 0.25; // Halo opacity as fraction of core alpha
const STAR_GLOW_MIN_SIZE        = 3;    // Minimum star size that can have a glow halo
const STAR_GLOW_PROB            = 0.6;  // Probability a large star gets a glow halo
const STAR_SEED                 = 54321;

const WeatherSystem = {
  // Config
  dayDurationSeconds: 120, // Reduced from 300 to 120 for faster cycle
  cycle: CYCLE_DAY_START,  // Start at full day to avoid initial "orange" filter

  // Colors (r, g, b, alpha) — standard dark-to-light transition
  colors: {
    night: [5, 5, 12, 230],     // Deep, almost black night (high contrast with torch)
    dawn: [200, 220, 255, 40],  // Soft blue/white dawn (removed orange)
    day: [0, 0, 0, 0],          // Clear (no overlay)
    dusk: [15, 15, 40, 140]     // Deep blue dusk
  },

  currentColor: [0, 0, 0, 0],
  lightMap: null,

  // --- Star System ---
  stars: [],
  starsGenerated: false,
  STAR_COUNT: 500,
  STAR_FIELD_SIZE: 4000,
  PARALLAX_FACTOR: 1.0,  // Stars fixed to world coordinates (1:1 with camera)
  STAR_DRIFT_SPEED: 0,   // No drift, perfectly static
  starTime: 0,

  // Star color palette for natural variety
  STAR_COLORS: [
    [255, 255, 255],   // Pure white
    [255, 255, 255],   // Pure white (more common)
    [200, 220, 255],   // Cool blue-white
    [180, 200, 255],   // Blue
    [255, 240, 220],   // Warm white
    [255, 220, 180],   // Warm yellow-white
    [255, 200, 200],   // Faint reddish
  ],

  /** Park-Miller LCG: returns a deterministic PRNG seeded by `seed`. */
  _seededRandom: function(seed) {
    let s = seed;
    return function() {
      // Multiplier 16807 (7^5), modulus 2147483647 (2^31 - 1, Mersenne prime)
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  },

  /** Populates `this.stars` with deterministically placed, sized, and coloured stars. */
  generateStars: function() {
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
        const size = sizeRoll < 0.55 ? 2 : (sizeRoll < 0.80 ? 3 : 4);

        // Multi-frequency twinkle for natural look
        const twinkleSpeed1 = 1.0 + rng() * 2.5;  // Primary oscillation
        const twinkleSpeed2 = 3.0 + rng() * 4.0;  // Secondary faster flicker
        const twinklePhase1 = rng() * Math.PI * 2;
        const twinklePhase2 = rng() * Math.PI * 2;
        const twinkleDepth = 0.3 + rng() * 0.5;   // Dim range (0.3 = subtle, 0.8 = dramatic)

        const colorIdx = Math.floor(rng() * this.STAR_COLORS.length);
        const color = this.STAR_COLORS[colorIdx];

        const hasGlow = size >= STAR_GLOW_MIN_SIZE && rng() < STAR_GLOW_PROB;

        this.stars.push({
          x, y, size, color, hasGlow,
          twinkleSpeed1, twinkleSpeed2,
          twinklePhase1, twinklePhase2,
          twinkleDepth
        });
        count++;
      }
    }
    this.starsGenerated = true;
  },

  /** Draws the star field onto the given 2D context, scaled by current darkness alpha. */
  drawStars: function(ctx, w, h, darknessAlpha, camX, camY) {
    if (darknessAlpha < STAR_VISIBILITY_MIN_ALPHA) return;

    if (!this.starsGenerated) this.generateStars();

    // Star visibility scales with darkness
    const starOpacity = Math.min(1.0, (darknessAlpha - STAR_VISIBILITY_MIN_ALPHA) / STAR_VISIBILITY_SCALE);
    const time = this.starTime;
    const fieldSize = this.STAR_FIELD_SIZE;

    const driftX = time * this.STAR_DRIFT_SPEED;
    const driftY = time * (this.STAR_DRIFT_SPEED * 0.2);

    const offsetX = (camX || 0) * this.PARALLAX_FACTOR + driftX;
    const offsetY = (camY || 0) * this.PARALLAX_FACTOR + driftY;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // Additive blending so stars glow on darkness

    for (const star of this.stars) {
      const sx = ((star.x - offsetX) % fieldSize + fieldSize) % fieldSize;
      const sy = ((star.y - offsetY) % fieldSize + fieldSize) % fieldSize;

      if (sx > w + 8 || sy > h + 8) continue;

      // Multi-frequency twinkle
      const wave1 = Math.sin(time * star.twinkleSpeed1 + star.twinklePhase1);
      const wave2 = Math.sin(time * star.twinkleSpeed2 + star.twinklePhase2);
      const twinkle = 1.0 - star.twinkleDepth * (0.6 * (0.5 + 0.5 * wave1) + 0.4 * (0.5 + 0.5 * wave2));

      const alpha = starOpacity * twinkle;
      const [r, g, b] = star.color;
      const px = Math.floor(sx);
      const py = Math.floor(sy);

      if (star.hasGlow) {
        const glowAlpha = alpha * STAR_GLOW_ALPHA_FACTOR;
        ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha.toFixed(3)})`;
        ctx.fillRect(px - 1, py - 1, star.size + 2, star.size + 2);
      }

      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.fillRect(px, py, star.size, star.size);
    }
    ctx.restore();
  },

  /** Advances the day/night cycle by `dt` ms and recalculates the overlay colour. */
  update: function(dt) {
    const increment = dt / 1000 / this.dayDurationSeconds;
    this.cycle = (this.cycle + increment) % 1.0;
    this.starTime += dt / 1000;
    this.calculateColor();
  },

  /** Resets the cycle to the start of day and clears the light map. */
  reset: function() {
    this.cycle = CYCLE_DAY_START;
    this.starTime = 0;
    this.calculateColor();
    if (this.lightMap) this.lightMap.clear();
  },

  /**
   * Maps the current cycle fraction to an RGBA overlay colour.
   * Cycle phases:
   *   [0, NIGHT_END)       → night
   *   [NIGHT_END, DAY_START) → dawn (night→dawn→day crossfade)
   *   [DAY_START, DAY_END)   → day
   *   [DAY_END, NIGHT_START) → dusk (day→dusk→night crossfade)
   *   [NIGHT_START, 1)     → night
   */
  calculateColor: function() {
    const t = this.cycle;

    if (t < CYCLE_NIGHT_END) {
      // Full night
      this.currentColor = [...this.colors.night];
    } else if (t < CYCLE_DAY_START) {
      // Dawn crossfade: night → dawn → day
      if (t < CYCLE_DAWN_MID) {
        const lerpT = (t - CYCLE_NIGHT_END) / (CYCLE_DAWN_MID - CYCLE_NIGHT_END);
        this.currentColor = this.lerpColor(this.colors.night, this.colors.dawn, lerpT);
      } else {
        const lerpT = (t - CYCLE_DAWN_MID) / (CYCLE_DAY_START - CYCLE_DAWN_MID);
        this.currentColor = this.lerpColor(this.colors.dawn, this.colors.day, lerpT);
      }
    } else if (t < CYCLE_DAY_END) {
      // Full day
      this.currentColor = [...this.colors.day];
    } else if (t < CYCLE_NIGHT_START) {
      // Dusk crossfade: day → dusk → night
      if (t < CYCLE_DUSK_MID) {
        const lerpT = (t - CYCLE_DAY_END) / (CYCLE_DUSK_MID - CYCLE_DAY_END);
        this.currentColor = this.lerpColor(this.colors.day, this.colors.dusk, lerpT);
      } else {
        const lerpT = (t - CYCLE_DUSK_MID) / (CYCLE_NIGHT_START - CYCLE_DUSK_MID);
        this.currentColor = this.lerpColor(this.colors.dusk, this.colors.night, lerpT);
      }
    } else {
      // Full night
      this.currentColor = [...this.colors.night];
    }
  },

  /** Linear interpolation between two RGBA colour arrays. */
  lerpColor: function(c1, c2, t) {
    return [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t,
      c1[3] + (c2[3] - c1[3]) * t
    ];
  },

  /**
   * Draws the darkness overlay and light halos onto the main canvas.
   * @param {number} w - Canvas width
   * @param {number} h - Canvas height
   * @param {Array}  lights - Screen-space light sources: {x, y, radius, r, g, b, intensity}
   * @param {number} camX - Camera world X (for star parallax)
   * @param {number} camY - Camera world Y (for star parallax)
   */
  drawOverlay: function(w, h, lights, camX, camY) {
    if (this.currentColor[3] < 5) return;

    if (!this.lightMap || this.lightMap.width !== w || this.lightMap.height !== h) {
      if (this.lightMap) this.lightMap.remove();
      this.lightMap = createGraphics(w, h);
    }

    const lm = this.lightMap;

    // Redraw darkness buffer every other frame for performance during night cycles
    if (typeof frameCount === 'undefined' || frameCount % 2 === 0) {
      lm.clear();
      lm.background(this.currentColor[0], this.currentColor[1], this.currentColor[2], this.currentColor[3]);

      if (lights && lights.length > 0) {
        const ctx = lm.drawingContext;
        lm.erase();
        lm.noStroke();

        for (const l of lights) {
          ctx.save();
          const rad = l.radius || 100;
          const grd = ctx.createRadialGradient(l.x, l.y, rad * 0.1, l.x, l.y, rad);
          grd.addColorStop(0, 'rgba(0,0,0,1)'); // Fully cut at centre
          grd.addColorStop(1, 'rgba(0,0,0,0)'); // Fade to darkness at edge
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(l.x, l.y, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        lm.noErase();
      }
    }

    image(lm, 0, 0);
  },

  /** Returns an [r, g, b, a] tint for clouds based on current ambient darkness. */
  getCloudTint: function() {
    const alpha = this.currentColor[3];
    const brightness = map(alpha, 0, 200, 255, 40); // Darken clouds significantly at night

    // Mix in ambient colour for coloured moonlight/dusklight tinting
    const r = map(this.currentColor[0], 0, 255, 255, 100);
    const g = map(this.currentColor[1], 0, 255, 255, 100);
    const b = map(this.currentColor[2], 0, 255, 255, 120);

    return [Math.min(r, brightness), Math.min(g, brightness), Math.min(b, brightness), 240];
  },

  /** Draws a pixel-art clock widget centred at (x, y) with the given radius. */
  drawClock: function(x, y, radius) {
    push();
    translate(x, y);
    rectMode(CENTER);

    const size = radius * 2;

    // --- 1. Outer Square Frame (Pixel-Themed Bronze) ---
    noStroke();
    fill(0, 120);
    rect(2, 2, size + 10, size + 10, 4);  // Drop shadow

    stroke(50, 40, 30);
    strokeWeight(3);
    fill(35, 30, 25); // Dark metallic backing
    rect(0, 0, size + 6, size + 6, 2);

    stroke(180, 150, 50); // Inner gold inlay
    strokeWeight(1.5);
    noFill();
    rect(0, 0, size + 2, size + 2, 1);

    // Corner rivets (mechanical pixel look)
    fill(100, 90, 80);
    noStroke();
    const off = size / 2 + 1;
    rect(-off, -off, 4, 4);
    rect( off, -off, 4, 4);
    rect( off,  off, 4, 4);
    rect(-off,  off, 4, 4);

    // --- 2. Quilted Background ---
    push();
    drawingContext.beginPath();
    drawingContext.rect(-size / 2, -size / 2, size, size);
    drawingContext.clip();

    stroke(45, 40, 35, 150);
    strokeWeight(1);
    const step = 10;
    for (let i = -size; i < size; i += step) {
      line(i, -size, i + size, size);
      line(i + size, -size, i, size);
    }

    // --- 3. Sky Strip (Rotates behind the frame) ---
    const skyRotation = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
    push();
    rotate(skyRotation);
    noStroke();
    fill(40, 100, 220, 100); // Day half
    arc(0, 0, size * 1.5, size * 1.5, PI, TWO_PI);
    fill(10, 10, 40, 140);   // Night half
    arc(0, 0, size * 1.5, size * 1.5, 0, PI);
    pop();

    pop(); // End clipping

    // --- 4. Celestial Icons ---
    const iconDist = radius - 6;
    const sunAngle  = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
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
    rect(4, -3, 8, 8, 1);  // Crescent mask
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
  }
};

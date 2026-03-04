
const WeatherSystem = {
  // Config
  dayDurationSeconds: 120, // Reduced from 300 to 120 for faster cycle
  cycle: 0.3, // Start at full day (0.3) instead of transition (0.25) to avoid initial "orange" filter

  // Colors (r, g, b, alpha) -> Standard dark to light transition
  colors: {
    night: [5, 5, 12, 230],     // Deep, almost black night (high contrast with torch)
    dawn: [200, 220, 255, 40],  // Soft blue/white dawn (removed orange)
    day: [0, 0, 0, 0],          // Clear
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

  _seededRandom: function(seed) {
    let s = seed;
    return function() {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  },

  generateStars: function() {
    this.stars = [];
    const rng = this._seededRandom(54321);
    const fieldSize = this.STAR_FIELD_SIZE;

    const cols = Math.ceil(Math.sqrt(this.STAR_COUNT));
    const rows = Math.ceil(this.STAR_COUNT / cols);
    const cellW = fieldSize / cols;
    const cellH = fieldSize / rows;

    let count = 0;
    for (let row = 0; row < rows && count < this.STAR_COUNT; row++) {
      for (let col = 0; col < cols && count < this.STAR_COUNT; col++) {
        const x = (col + rng()) * cellW;
        const y = (row + rng()) * cellH;

        const sizeRoll = rng();
        const size = sizeRoll < 0.55 ? 2 : (sizeRoll < 0.80 ? 3 : 4);

        // Multi-frequency twinkle for natural look
        const twinkleSpeed1 = 1.0 + rng() * 2.5;  // Primary oscillation
        const twinkleSpeed2 = 3.0 + rng() * 4.0;  // Secondary faster flicker
        const twinklePhase1 = rng() * Math.PI * 2;
        const twinklePhase2 = rng() * Math.PI * 2;
        const twinkleDepth = 0.3 + rng() * 0.5;   // How much it dims (0.3 = subtle, 0.8 = dramatic)

        // Pick a natural color
        const colorIdx = Math.floor(rng() * this.STAR_COLORS.length);
        const color = this.STAR_COLORS[colorIdx];

        // Bright stars get a glow halo
        const hasGlow = size >= 3 && rng() < 0.6;

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

  drawStars: function(ctx, w, h, darknessAlpha, camX, camY) {
    if (darknessAlpha < 60) return;

    if (!this.starsGenerated) {
      this.generateStars();
    }

    // Star visibility scales with darkness
    const starOpacity = Math.min(1.0, (darknessAlpha - 60) / 80);
    const time = this.starTime;
    const fieldSize = this.STAR_FIELD_SIZE;

    // Calculate continuous drift (moving like clouds)
    const driftX = time * this.STAR_DRIFT_SPEED;
    const driftY = time * (this.STAR_DRIFT_SPEED * 0.2); // slight diagonal movement

    const offsetX = (camX || 0) * this.PARALLAX_FACTOR + driftX;
    const offsetY = (camY || 0) * this.PARALLAX_FACTOR + driftY;

    ctx.save();
    // Use additive blending so stars GLOW on top of darkness
    ctx.globalCompositeOperation = 'lighter';

    for (const star of this.stars) {
      let sx = ((star.x - offsetX) % fieldSize + fieldSize) % fieldSize;
      let sy = ((star.y - offsetY) % fieldSize + fieldSize) % fieldSize;

      if (sx > w + 8 || sy > h + 8) continue;

      // Multi-frequency twinkle for natural look
      const wave1 = Math.sin(time * star.twinkleSpeed1 + star.twinklePhase1);
      const wave2 = Math.sin(time * star.twinkleSpeed2 + star.twinklePhase2);
      const twinkle = 1.0 - star.twinkleDepth * (0.6 * (0.5 + 0.5 * wave1) + 0.4 * (0.5 + 0.5 * wave2));

      const alpha = starOpacity * twinkle;
      const [r, g, b] = star.color;

      const px = Math.floor(sx);
      const py = Math.floor(sy);

      // Draw glow halo first (bigger, dimmer) for bright stars
      if (star.hasGlow) {
        const glowAlpha = alpha * 0.25;
        ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha.toFixed(3)})`;
        ctx.fillRect(px - 1, py - 1, star.size + 2, star.size + 2);
      }

      // Core star pixel
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.fillRect(px, py, star.size, star.size);
    }
    ctx.restore();
  },

  update: function(dt) {
    const increment = dt / 1000 / this.dayDurationSeconds;
    this.cycle = (this.cycle + increment) % 1.0;
    this.starTime += dt / 1000;
    this.calculateColor();
  },

  reset: function() {
    this.cycle = 0.3; // Start at full day
    this.starTime = 0;
    this.calculateColor();
    if (this.lightMap) {
        this.lightMap.clear();
    }
  },

  calculateColor: function() {
    let t = this.cycle;
    let lerpT;

    if (t < 0.2) { // Night
      this.currentColor = [...this.colors.night];
    } else if (t < 0.3) { // Dawn (10% of cycle)
      if (t < 0.25) {
         lerpT = (t - 0.2) / 0.05;
         this.currentColor = this.lerpColor(this.colors.night, this.colors.dawn, lerpT);
      } else {
         lerpT = (t - 0.25) / 0.05;
         this.currentColor = this.lerpColor(this.colors.dawn, this.colors.day, lerpT);
      }
    } else if (t < 0.6) { // Day (30% of cycle)
      this.currentColor = [...this.colors.day];
    } else if (t < 0.9) { // Extended Dusk/Evening (30% of cycle) for gradual darkening
      if (t < 0.75) {
        // Day to Dusk (Fading light)
        lerpT = (t - 0.6) / 0.15;
        this.currentColor = this.lerpColor(this.colors.day, this.colors.dusk, lerpT);
      } else {
        // Dusk to Night (Becoming dark)
        lerpT = (t - 0.75) / 0.15;
        this.currentColor = this.lerpColor(this.colors.dusk, this.colors.night, lerpT);
      }
    } else { // Night
      this.currentColor = [...this.colors.night];
    }
  },

  lerpColor: function(c1, c2, t) {
    return [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t,
      c1[3] + (c2[3] - c1[3]) * t
    ];
  },

  // Accepts lights array and camera world position for star parallax
  drawOverlay: function(w, h, lights, camX, camY) {
    if (this.currentColor[3] < 5) return;

    if (!this.lightMap || this.lightMap.width !== w || this.lightMap.height !== h) {
       if (this.lightMap) this.lightMap.remove();
       this.lightMap = createGraphics(w, h);
    }

    const lm = this.lightMap;

    // Performance optimization: Redraw the darkness/lighting buffer only every 2 frames
    // This provides a significant FPS boost during night cycles
    if (typeof frameCount === 'undefined' || frameCount % 2 === 0) {
        lm.clear();

        // 1. Fill with darkness
        lm.background(this.currentColor[0], this.currentColor[1], this.currentColor[2], this.currentColor[3]);

        // 2. Process Lights
        if (lights && lights.length > 0) {
           const ctx = lm.drawingContext;
           lm.erase();
           lm.noStroke();

           for (const l of lights) {
              ctx.save();
              const rad = l.radius || 100;
              const grd = ctx.createRadialGradient(l.x, l.y, rad * 0.1, l.x, l.y, rad);
              grd.addColorStop(0, `rgba(0,0,0,1)`);   // Cut completely center
              grd.addColorStop(1, `rgba(0,0,0,0)`);   // Fade to darkness edge

              ctx.fillStyle = grd;
              ctx.beginPath();
              ctx.arc(l.x, l.y, rad, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
           }
           lm.noErase();
        }
    }

    // Draw the lightmap onto the main canvas
    image(lm, 0, 0);
  },

  getCloudTint: function() {
    const alpha = this.currentColor[3];
    // Darken clouds significantly at night
    const brightness = map(alpha, 0, 200, 255, 40);

    // Mix in some of the ambient color
    const r = map(this.currentColor[0], 0, 255, 255, 100);
    const g = map(this.currentColor[1], 0, 255, 255, 100);
    const b = map(this.currentColor[2], 0, 255, 255, 120);

    return [Math.min(r, brightness), Math.min(g, brightness), Math.min(b, brightness), 240];
  },

  drawClock: function(x, y, radius) {
     push();
     translate(x, y);
     rectMode(CENTER);

     const size = radius * 2;

     // --- 1. Outer Square Frame (Pixel-Themed Bronze) ---
     // Drop Shadow
     noStroke();
     fill(0, 120);
     rect(2, 2, size + 10, size + 10, 4);

     // Main Bronze Box
     stroke(50, 40, 30); // Darker border
     strokeWeight(3);
     fill(35, 30, 25); // Dark metallic backing
     rect(0, 0, size + 6, size + 6, 2);

     // Inner Gold Inlay
     stroke(180, 150, 50);
     strokeWeight(1.5);
     noFill();
     rect(0, 0, size + 2, size + 2, 1);

     // Corner Rivets (Mechanical pixel look)
     fill(100, 90, 80);
     noStroke();
     const off = size/2 + 1;
     rect(-off, -off, 4, 4);
     rect(off, -off, 4, 4);
     rect(off, off, 4, 4);
     rect(-off, off, 4, 4);

     // --- 2. Quilted Background (Theme matching) ---
     push();
     // Clip to inner square
     drawingContext.beginPath();
     drawingContext.rect(-size/2, -size/2, size, size);
     drawingContext.clip();

     // Quilted texture
     stroke(45, 40, 35, 150);
     strokeWeight(1);
     const step = 10;
     for(let i = -size; i < size; i += step) {
        line(i, -size, i + size, size);
        line(i + size, -size, i, size);
     }

     // --- 3. Sky "Strip" (Rotates behind the frame) ---
     const skyRotation = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
     push();
     rotate(skyRotation);
     noStroke();
     // Day half
     fill(40, 100, 220, 100);
     arc(0, 0, size * 1.5, size * 1.5, PI, TWO_PI);
     // Night half
     fill(10, 10, 40, 140);
     arc(0, 0, size * 1.5, size * 1.5, 0, PI);
     pop();

     pop(); // End Clipping

     // --- 4. Celestial Icons (Moving in a square path or circle within) ---
     const iconDist = radius - 6;
     const sunAngle = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
     const moonAngle = sunAngle + PI;

     // Draw Sun
     push();
     translate(cos(sunAngle) * iconDist, sin(sunAngle) * iconDist);
     // Sun Glow
     noStroke();
     fill(255, 200, 50, 80);
     circle(0, 0, 16);
     // Square Sun Core (Pixel look)
     fill(255, 255, 200);
     rect(0, 0, 10, 10);
     // "Pixel" Rays
     stroke(255, 215, 0, 200);
     strokeWeight(2);
     for(let i=0; i<4; i++) {
        rotate(PI/2);
        const rLen = 9 + sin(millis() * 0.005 + i) * 2;
        line(0, 6, 0, rLen);
     }
     pop();

     // Draw Moon
     push();
     translate(cos(moonAngle) * iconDist, sin(moonAngle) * iconDist);
     // Moon Glow
     noStroke();
     fill(150, 180, 255, 40);
     rect(0, 0, 14, 14, 2);
     // Moon Shape (Blocky Crescent)
     fill(220, 230, 255);
     rect(0, 0, 10, 10, 1);
     fill(30, 25, 20); // Masking for crescent
     rect(4, -3, 8, 8, 1);
     pop();

     // --- 5. Glass / Reflection ---
     noStroke();
     fill(255, 30);
     triangle(-radius, -radius, radius, -radius, -radius, radius);

     // --- 6. Top Pointer (Static Indicator) ---
     fill(255, 215, 0);
     noStroke();
     // Small square gem at top
     rect(0, -radius - 4, 6, 6);

     pop();
  }
};

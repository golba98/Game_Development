
const WeatherSystem = {
  // Config
  dayDurationSeconds: 150, // Slightly longer cycle for smoother transitions
  cycle: 0.5, // Start exactly at Noon (0.5)
  
  // Colors (r, g, b, alpha) -> Standard dark to light transition
  colors: {
    night: [5, 5, 15, 240],      // Dark / virtually black, high opacity
    dawn:  [5, 5, 15, 120],      // Gradual lightening, no orange
    day:   [0, 0, 0, 0],         // Perfectly clear
    dusk:  [5, 5, 15, 150]       // Gradual darkening, no purple
  },

  currentColor: [0, 0, 0, 0],
  lightMap: null,

  // --- Star System ---
  stars: [],
  starsGenerated: false,
  STAR_COUNT: 600,       // More stars for the large world area
  STAR_FIELD_SIZE: 4000, // Stars tile in a 4000x4000 world-space block
  PARALLAX_FACTOR: 0.15, // Stars move slower than camera (far away sky feel)
  starTime: 0,

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
    
    // Jittered grid across the star field for even distribution
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
        const size = sizeRoll < 0.6 ? 2 : (sizeRoll < 0.85 ? 3 : 4);
        const baseBrightness = 200 + Math.floor(rng() * 55); // 200-255 (brighter)
        const twinkleSpeed = 0.5 + rng() * 2.0;
        const twinkleOffset = rng() * Math.PI * 2;
        
        this.stars.push({ x, y, size, baseBrightness, twinkleSpeed, twinkleOffset });
        count++;
      }
    }
    this.starsGenerated = true;
  },

  drawStars: function(ctx, w, h, darknessAlpha, camX, camY) {
    // Stars visible when darkness alpha > 60
    if (darknessAlpha < 60) return;
    
    if (!this.starsGenerated) {
      this.generateStars();
    }
    
    // Star visibility scales with darkness — fully visible at alpha 160+
    const starOpacity = Math.min(1.0, (darknessAlpha - 60) / 100);
    const time = this.starTime;
    const fieldSize = this.STAR_FIELD_SIZE;
    
    // Camera offset with parallax (stars move slowly)
    const offsetX = (camX || 0) * this.PARALLAX_FACTOR;
    const offsetY = (camY || 0) * this.PARALLAX_FACTOR;
    
    ctx.save();
    for (const star of this.stars) {
      // World-space position offset by camera, then wrap (tile the star field)
      let sx = ((star.x - offsetX) % fieldSize + fieldSize) % fieldSize;
      let sy = ((star.y - offsetY) % fieldSize + fieldSize) % fieldSize;
      
      // Only draw stars visible on screen
      if (sx > w + 4 || sy > h + 4) continue;
      
      // Twinkle
      const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
      const brightness = Math.floor(star.baseBrightness * (0.6 + 0.4 * twinkle));
      const alpha = starOpacity * (0.5 + 0.5 * twinkle);
      
      // Slightly blue-white tint
      const r = brightness;
      const g = brightness;
      const b = Math.min(255, brightness + 25);
      
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), star.size, star.size);
    }
    ctx.restore();
  },
  
  update: function(dt) {
    const increment = dt / 1000 / this.dayDurationSeconds;
    this.cycle = (this.cycle + increment) % 1.0;
    this.starTime += dt / 1000;
    this.calculateColor();
  },

  calculateColor: function() {
    let t = this.cycle;
    let lerpT;

    // Redesigned logical cycle:
    // 0.00 - 0.15 : Deep Night
    // 0.15 - 0.25 : Night -> Dawn
    // 0.25 - 0.35 : Dawn -> Day
    // 0.35 - 0.65 : Full Day
    // 0.65 - 0.75 : Day -> Dusk
    // 0.75 - 0.85 : Dusk -> Night
    // 0.85 - 1.00 : Deep Night

    if (t < 0.15) { 
      this.currentColor = [...this.colors.night];
    } 
    else if (t < 0.25) { 
      lerpT = (t - 0.15) / 0.10;
      this.currentColor = this.lerpColor(this.colors.night, this.colors.dawn, lerpT);
    } 
    else if (t < 0.35) { 
      lerpT = (t - 0.25) / 0.10;
      this.currentColor = this.lerpColor(this.colors.dawn, this.colors.day, lerpT);
    } 
    else if (t < 0.65) { 
      this.currentColor = [...this.colors.day];
    } 
    else if (t < 0.75) { 
      lerpT = (t - 0.65) / 0.10;
      this.currentColor = this.lerpColor(this.colors.day, this.colors.dusk, lerpT);
    } 
    else if (t < 0.85) { 
      lerpT = (t - 0.75) / 0.10;
      this.currentColor = this.lerpColor(this.colors.dusk, this.colors.night, lerpT);
    } 
    else { 
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

  // Now accepts lights array: [{x, y, radius, r, g, b, intensity}]
  // x, y are SCREEN coordinates
  drawOverlay: function(w, h, lights, camX, camY) {
    if (this.currentColor[3] < 5) return; // Don't draw if fully clear

    // Initialize or Resize Buffer
    if (!this.lightMap || this.lightMap.width !== w || this.lightMap.height !== h) {
       if (this.lightMap) this.lightMap.remove();
       this.lightMap = createGraphics(w, h);
    }

    const lm = this.lightMap;
    lm.clear();

    // 1. Draw stars BEFORE the darkness fill (they sit behind the overlay)
    this.drawStars(lm.drawingContext, w, h, this.currentColor[3], camX, camY);
    
    // 2. Fill with darkness (drawn on top of stars using source-over,
    //    so stars peek through where the overlay is semi-transparent)
    lm.drawingContext.save();
    lm.drawingContext.globalCompositeOperation = 'source-over';
    lm.drawingContext.fillStyle = `rgba(${this.currentColor[0]},${this.currentColor[1]},${this.currentColor[2]},${this.currentColor[3] / 255})`;
    lm.drawingContext.fillRect(0, 0, w, h);
    lm.drawingContext.restore();

    // 3. Process Lights
    if (lights && lights.length > 0) {
       // Pass 1: Cut out visibility holes (remove darkness)
       lm.drawingContext.save();
       lm.drawingContext.globalCompositeOperation = 'destination-out';
       for (const l of lights) {
          const rad = l.radius || 100;
          const grd = lm.drawingContext.createRadialGradient(l.x, l.y, rad * 0.1, l.x, l.y, rad);
          grd.addColorStop(0, `rgba(0,0,0,1)`);   
          grd.addColorStop(1, `rgba(0,0,0,0)`);   
          lm.drawingContext.fillStyle = grd;
          lm.drawingContext.beginPath();
          lm.drawingContext.arc(l.x, l.y, rad, 0, Math.PI * 2);
          lm.drawingContext.fill();
       }
       lm.drawingContext.restore();
       
       // Pass 2: Add Color Tints
       lm.drawingContext.save();
       lm.drawingContext.globalCompositeOperation = 'source-over';
       for (const l of lights) {
           if (l.color) {
              const rad = l.radius || 100;
              const [r, g, b] = l.color;
              const intensity = l.intensity !== undefined ? l.intensity : 0.3; // Default tint intensity
              
              const grd = lm.drawingContext.createRadialGradient(l.x, l.y, 0, l.x, l.y, rad);
              // Center is colored, fading out
              grd.addColorStop(0, `rgba(${r},${g},${b},${intensity})`);
              grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
              
              lm.drawingContext.fillStyle = grd;
              lm.drawingContext.beginPath();
              lm.drawingContext.arc(l.x, l.y, rad, 0, Math.PI * 2);
              lm.drawingContext.fill();
           }
       }
       lm.drawingContext.restore();
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
     
     // Background Box
     const boxSize = radius * 2.2;
     if (typeof BUTTON_BG !== 'undefined' && BUTTON_BG) {
         imageMode(CENTER);
         image(BUTTON_BG, 0, 0, boxSize, boxSize);
         imageMode(CORNER);
     } else {
         stroke(0); strokeWeight(4); fill(20, 20, 20, 180);
         rectMode(CENTER);
         rect(0, 0, boxSize, boxSize, 4);
         rectMode(CORNER);
     }
     
     // Gold Inner Border
     if (typeof MENU_GOLD_BORDER !== 'undefined') {
         stroke(MENU_GOLD_BORDER);
         strokeWeight(2); noFill();
         rectMode(CENTER);
         rect(0, 0, boxSize - 6, boxSize - 6, 2);
         rectMode(CORNER);
     } else {
         stroke(255, 215, 0, 100);
         strokeWeight(2); noFill();
         rectMode(CENTER);
         rect(0, 0, boxSize - 6, boxSize - 6, 2);
         rectMode(CORNER);
     }

     const angle = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
     rotate(angle);
     
     const iconDist = radius - 8;
     
     // Draw Moon (Blocky style)
     push();
     translate(0, iconDist); // Bottom
     fill(200, 200, 255); noStroke();
     rectMode(CENTER);
     rect(0, 0, 10, 10, 2); // Moon 
     fill(0, 0, 0, 150);
     rect(3, -2, 6, 6, 2); // Crescent cutout
     rectMode(CORNER);
     pop();

     // Draw Sun (Blocky style)
     push();
     rotate(PI);
     translate(0, iconDist);
     fill(255, 200, 0); noStroke();
     rectMode(CENTER);
     rect(0, 0, 10, 10, 2);
     // Cross Rays
     fill(255, 200, 0, 150);
     rect(0, -9, 4, 4);
     rect(0, 9, 4, 4);
     rect(-9, 0, 4, 4);
     rect(9, 0, 4, 4);
     rectMode(CORNER);
     pop();
     
     // Horizon Line (Static)
     pop(); 
     
     push();
     translate(x, y);
     stroke(255, 40);
     strokeWeight(2);
     line(-radius + 2, 0, radius - 2, 0);
     pop();
  }
};

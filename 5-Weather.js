
const WeatherSystem = {
  // Config
  dayDurationSeconds: 120, // Reduced from 300 to 120 for faster cycle
  cycle: 0.5, // Start at Noon for pure bright daylight
  
  // Colors (r, g, b, alpha)
  colors: {
    night: [10, 15, 30, 230],      // Clean, deep midnight blue-black
    day: [0, 0, 0, 0]              // Pure clear day
  },

  currentColor: [0, 0, 0, 0],
  lightMap: null,
  
  update: function(dt) {
    const increment = dt / 1000 / this.dayDurationSeconds;
    this.cycle = (this.cycle + increment) % 1.0;
    this.calculateColor();
  },

  calculateColor: function() {
    let t = this.cycle;
    let lerpT;

    // Direct, progressive fade logic:
    // 0.0 - 0.2: Full Night
    // 0.2 - 0.4: Fading into Day
    // 0.4 - 0.7: Full Day
    // 0.7 - 0.9: Fading into Night
    // 0.9 - 1.0: Full Night

    if (t < 0.2) { 
      this.currentColor = [...this.colors.night];
    } else if (t < 0.4) { // Morning Fade
      lerpT = (t - 0.2) / 0.2;
      this.currentColor = this.lerpColor(this.colors.night, this.colors.day, lerpT);
    } else if (t < 0.7) { // Full Day
      this.currentColor = [...this.colors.day];
    } else if (t < 0.9) { // Evening Fade
      lerpT = (t - 0.7) / 0.2;
      this.currentColor = this.lerpColor(this.colors.day, this.colors.night, lerpT);
    } else { 
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
  drawOverlay: function(w, h, lights) {
    if (this.currentColor[3] < 5) return; // Don't draw if fully clear

    // Initialize or Resize Buffer
    if (!this.lightMap || this.lightMap.width !== w || this.lightMap.height !== h) {
       if (this.lightMap) this.lightMap.remove();
       this.lightMap = createGraphics(w, h);
    }

    const lm = this.lightMap;
    lm.clear();
    
    // 1. Fill with darkness
    lm.background(this.currentColor[0], this.currentColor[1], this.currentColor[2], this.currentColor[3]);

    // 2. Process Lights
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
    
    // Mix in some of the ambient color (e.g. orange at dawn)
    const r = map(this.currentColor[0], 0, 255, 255, 100); 
    const g = map(this.currentColor[1], 0, 255, 255, 100);
    const b = map(this.currentColor[2], 0, 255, 255, 120);
    
    return [Math.min(r, brightness), Math.min(g, brightness), Math.min(b, brightness), 240]; 
  },

  drawClock: function(x, y, radius) {
     push();
     translate(x, y);
     
     // 1. Pixelly Outer Ring (Blocky Border)
     noFill();
     strokeWeight(2);
     stroke(0, 150);
     // Use a square with slightly clipped corners for a 'pixel-circle' look
     rect(-radius, -radius, radius*2, radius*2, 4); 
     
     stroke(255, 215, 0, 150);
     rect(-radius+2, -radius+2, radius*2-4, radius*2-4, 2);

     // 2. Background (Dark glass)
     noStroke();
     fill(10, 10, 25, 180);
     rect(-radius+3, -radius+3, radius*2-6, radius*2-6);

     // 3. Horizon Line (Sharp)
     stroke(255, 40);
     strokeWeight(1);
     line(-radius+4, 0, radius-4, 0);

     // 4. Moving Elements (Sun/Moon)
     // Rotate the 'sky' based on cycle
     // 0.0 = Midnight (Bottom), 0.5 = Noon (Top)
     const angle = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
     rotate(angle);
     
     const iconDist = radius - 12;
     
     // --- PIXEL MOON (at 0.0) ---
     push();
     translate(0, iconDist); 
     noStroke();
     fill(200, 210, 255);
     // Hand-drawn pixel moon (3x3 blocky)
     rect(-4, -4, 8, 8);
     // Craters / Shade
     fill(100, 110, 180, 150);
     rect(0, 0, 3, 3);
     rect(-3, -2, 2, 2);
     pop();

     // --- PIXEL SUN (at 0.5) ---
     push();
     rotate(PI);
     translate(0, iconDist);
     noStroke();
     // Bright core
     fill(255, 255, 150);
     rect(-5, -5, 10, 10);
     // Rays (Pixel style)
     fill(255, 200, 0, 200);
     rect(-1, -9, 2, 3);  // Top
     rect(-1, 6, 2, 3);   // Bottom
     rect(-9, -1, 3, 2);  // Left
     rect(6, -1, 3, 2);   // Right
     pop();
     
     pop(); 
  }
};


const WeatherSystem = {
  // Config
  dayDurationSeconds: 150, // Slightly longer cycle for smoother transitions
  cycle: 0.5, // Start exactly at Noon (0.5)
  
  // Colors (r, g, b, alpha) -> Better calibrated for pixel-art
  colors: {
    night: [4, 4, 15, 240],      // Deep indigo / virtually black, high opacity
    dawn:  [255, 160, 60, 100],  // Warm orange/pink morning glow
    day:   [0, 0, 0, 0],         // Perfectly clear
    dusk:  [80, 30, 100, 130]    // Deep purple / magenta twilight
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

    // Redesigned logical cycle:
    // 0.00 - 0.15 : Deep Night
    // 0.15 - 0.25 : Night -> Dawn
    // 0.25 - 0.35 : Dawn -> Day
    // 0.35 - 0.65 : Full Day
    // 0.65 - 0.75 : Day -> Dusk
    // 0.75 - 0.85 : Dusk -> Night
    // 0.85 - 1.00 : Deep Night

    if (t < 0.15) { 
      // Deep Night 
      this.currentColor = [...this.colors.night];
    } 
    else if (t < 0.25) { 
      // Night -> Dawn Glow (10% of cycle)
      lerpT = (t - 0.15) / 0.10;
      this.currentColor = this.lerpColor(this.colors.night, this.colors.dawn, lerpT);
    } 
    else if (t < 0.35) { 
      // Dawn Glow -> Full Day (10% of cycle)
      lerpT = (t - 0.25) / 0.10;
      this.currentColor = this.lerpColor(this.colors.dawn, this.colors.day, lerpT);
    } 
    else if (t < 0.65) { 
      // Full Day (30% of cycle)
      this.currentColor = [...this.colors.day];
    } 
    else if (t < 0.75) { 
      // Day -> Dusk Glow (10% of cycle)
      lerpT = (t - 0.65) / 0.10;
      this.currentColor = this.lerpColor(this.colors.day, this.colors.dusk, lerpT);
    } 
    else if (t < 0.85) { 
      // Dusk Glow -> Deep Night (10% of cycle)
      lerpT = (t - 0.75) / 0.10;
      this.currentColor = this.lerpColor(this.colors.dusk, this.colors.night, lerpT);
    } 
    else { 
      // Deep Night (15% of cycle remaining to reach 1.0)
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

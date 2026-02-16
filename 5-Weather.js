
const WeatherSystem = {
  // Config
  dayDurationSeconds: 120, // Reduced from 300 to 120 for faster cycle
  cycle: 0.25, // Start at dawn/day transition for better first impression
  
  // Colors (r, g, b, alpha)
  colors: {
    night: [5, 5, 20, 230],      // Deep midnight blue-black
    dawn: [255, 245, 210, 80],   // Soft, desaturated morning cream/gold
    day: [0, 0, 0, 0],           // Clear day
    dusk: [40, 60, 120, 150]     // Cool twilight blue
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

    // Adjusted timings for a 120s cycle:
    // Transitions are now 10% each (12s) instead of 5% (6s)
    if (t < 0.15) { // Deep Night
      this.currentColor = [...this.colors.night];
    } else if (t < 0.35) { // Dawn Transition
      if (t < 0.25) {
         // Night -> Dawn Glow (12s)
         lerpT = (t - 0.15) / 0.10;
         this.currentColor = this.lerpColor(this.colors.night, this.colors.dawn, lerpT);
      } else {
         // Dawn Glow -> Full Day (12s)
         lerpT = (t - 0.25) / 0.10;
         this.currentColor = this.lerpColor(this.colors.dawn, this.colors.day, lerpT);
      }
    } else if (t < 0.65) { // Full Day
      this.currentColor = [...this.colors.day];
    } else if (t < 0.85) { // Dusk Transition
      if (t < 0.75) {
        // Day -> Dusk Glow (12s)
        lerpT = (t - 0.65) / 0.10;
        this.currentColor = this.lerpColor(this.colors.day, this.colors.dusk, lerpT);
      } else {
        // Dusk Glow -> Deep Night (12s)
        lerpT = (t - 0.75) / 0.10;
        this.currentColor = this.lerpColor(this.colors.dusk, this.colors.night, lerpT);
      }
    } else { // Deep Night
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
     
     // Background
     noStroke();
     fill(0, 0, 0, 150);
     circle(0, 0, radius * 2);
     stroke(255, 215, 0, 100);
     strokeWeight(2);
     noFill();
     circle(0, 0, radius * 2);

     // Cycle indicator
     // 0.0 = Midnight (Bottom)
     // 0.25 = Dawn (Left) - Wait, usually Sun rises East/Right? 
     // Let's standardise: 
     // 0.0 (Midnight) -> Bottom (-PI/2 ? No, PI/2)
     // 0.5 (Noon) -> Top (-PI/2)
     
     // Rotate so 0.5 is up (-90 deg)
     // 0.0 should be down (90 deg)
     // Map cycle 0..1 to 0..TWO_PI, plus offset
     const angle = map(this.cycle, 0, 1, 0, TWO_PI) + HALF_PI;
     
     rotate(angle);
     
     // Sun/Moon position (on the ring)
     const iconDist = radius - 8;
     
     // Sun (at 0.5 cycle, which is PI from 0.0) -> Opposite to "Current Time"?
     // Wait, if I rotate the whole sky, the pointer is static? 
     // Let's rotate the 'sky' so the icons move.
     
     // Sun is at Noon (0.5). So at cycle 0.5, Sun should be at Top.
     // Current rotation puts 0.0 at Bottom.
     // So Noon (0.5) is at Bottom + PI = Top. Correct.
     
     // Draw Moon (at 0.0)
     push();
     translate(0, iconDist); // Bottom
     fill(200, 200, 255); noStroke();
     circle(0, 0, 10); // Moon shape
     fill(0, 0, 0, 150);
     circle(3, -2, 8); // Crater/Crescent cut
     pop();

     // Draw Sun (at 0.5)
     push();
     rotate(PI);
     translate(0, iconDist);
     fill(255, 200, 0); noStroke();
     circle(0, 0, 12);
     // Rays
     stroke(255, 200, 0, 100); strokeWeight(2);
     for(let i=0; i<8; i++) {
        line(0, 0, 0, 18);
        rotate(PI/4);
     }
     pop();
     
     // Horizon Line (Visual candy)
     // Reset Rotation to draw static elements
     pop(); 
     
     push();
     translate(x, y);
     stroke(255, 50);
     line(-radius, 0, radius, 0); // Horizon
     pop();
  }
};


const WeatherSystem = {
  // Config
  dayDurationSeconds: 120, // Reduced from 300 to 120 for faster cycle
  cycle: 0.25, // Start at dawn/day transition for better first impression
  
  // Colors (r, g, b, alpha)
  colors: {
    night: [5, 5, 12, 230],     // Deep, almost black night (high contrast with torch)
    dawn: [255, 230, 200, 60],  // Subtle, pale warm glow (realistic morning light)
    day: [0, 0, 0, 0],          // Clear
    dusk: [40, 30, 60, 120]     // Desaturated cool violet/grey (fading light)
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

    if (t < 0.2) { // Night
      this.currentColor = [...this.colors.night];
    } else if (t < 0.3) { // Dawn
      if (t < 0.25) {
         lerpT = (t - 0.2) / 0.05;
         this.currentColor = this.lerpColor(this.colors.night, this.colors.dawn, lerpT);
      } else {
         lerpT = (t - 0.25) / 0.05;
         this.currentColor = this.lerpColor(this.colors.dawn, this.colors.day, lerpT);
      }
    } else if (t < 0.7) { // Day
      this.currentColor = [...this.colors.day];
    } else if (t < 0.8) { // Dusk
      if (t < 0.75) {
        lerpT = (t - 0.7) / 0.05;
        this.currentColor = this.lerpColor(this.colors.day, this.colors.dusk, lerpT);
      } else {
        lerpT = (t - 0.75) / 0.05;
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

    // 2. Cut out lights
    if (lights && lights.length > 0) {
       lm.erase();
       lm.noStroke();
       
       for (const l of lights) {
          // Simple gradient cutout
          // Since erase() doesn't support gradients natively in all p5 modes easily,
          // we use standard drawing but with "destination-out" logic if we were in raw canvas.
          // But p5's erase() sets blending mode.
          // To get soft edges, we can draw concentric circles with decreasing opacity (increasing erase strength)
          // OR, simpler: just use native canvas API on the buffer.
          
          const ctx = lm.drawingContext;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          
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

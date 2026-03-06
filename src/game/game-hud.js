// game-hud.js — HUD: health bar, minimap, score, inventory, compass, clouds
// Extracted from 4-Game.js

// Maps lastDirection strings to radians for the minimap player arrow.
// N = up (-HALF_PI), E = right (0), S = down (HALF_PI), W = PI, plus diagonals.
const DIRECTION_TO_ANGLE_MAP = {
  'N':  -Math.PI / 2,
  'NE': -Math.PI / 4,
  'E':   0,
  'SE':  Math.PI / 4,
  'S':   Math.PI / 2,
  'SW':  Math.PI / 2 + Math.PI / 4,
  'W':   Math.PI,
  'NW': -Math.PI / 2 - Math.PI / 4,
};

function drawXPBar() {
  const vW = virtualW || (width / gameScale);
  const vH = virtualH || (height / gameScale);
  
  const barW = Math.min(vW * 0.5, 400); // 50% of width, max 400px
  const barH = 12;
  const startX = (vW - barW) / 2;
  const startY = vH - 60; // moved up gently to prevent bottom cutoff
  
  push();
  
  // UI Pulse Effect when XP is gained
  const now = typeof millis === 'function' ? millis() : Date.now();
  let pulseScale = 1.0;
  if (now - lastXpChange < 300) {
      pulseScale = map(now - lastXpChange, 0, 300, 1.05, 1.0);
  }
  
  translate(startX + barW/2, startY + barH/2);
  scale(pulseScale);
  translate(-(startX + barW/2), -(startY + barH/2));

  // Themed Background Container
  if (typeof BUTTON_BG !== 'undefined' && BUTTON_BG) {
      image(BUTTON_BG, startX - 20, startY - 14, barW + 40, barH + 28);
  } else {
      stroke(0);
      strokeWeight(4);
      fill(20, 20, 20, 200);
      rect(startX - 20, startY - 14, barW + 40, barH + 28, 4);
  }
  
  // Gold Inner Border
  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  noFill();
  rect(startX - 17, startY - 11, barW + 34, barH + 22, 2);

  // Bar Background (empty part)
  noStroke();
  fill(30, 30, 40, 255);
  rect(startX, startY, barW, barH, 4);

  // Bar Fill
  const xpPct = constrain(playerXP / xpToNextLevel, 0, 1);
  if (xpPct > 0) {
    fill(100, 200, 255, 255);
    rect(startX, startY, barW * xpPct, barH, 4);
    
    // Glossy highlight
    fill(255, 255, 255, 60);
    rect(startX, startY, barW * xpPct, barH / 2, 4);
  }

  // Level Text
  if (typeof uiFont !== 'undefined' && uiFont) textFont(uiFont);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  let sz = typeof gTextSize === 'function' ? 14 : 14;
  if (typeof gTextSize === 'function') gTextSize(sz); else textSize(sz);
  text(`Lv ${playerLevel} (${playerXP}/${xpToNextLevel})`, startX + barW/2, startY - 20);
  
  // Stat points indicator
  if (statPoints > 0) {
      fill(255, 215, 0); // Gold for available stat points
      text(`+${statPoints} Stat Points (Press I)`, startX + barW/2, startY - 40);
  }

  pop();
}

function drawHealthBar() {
  const startX = 50; 
  const startY = 30;
  const barW = 160;
  const barH = 18;

  push();
  
  // UI Pulse Effect
  const now = millis();
  let pulseScale = 1.0;
  if (now - lastHealthChange < 200) {
      pulseScale = map(now - lastHealthChange, 0, 200, 1.1, 1.0);
  }
  
  translate(startX + barW/2, startY + barH/2);
  scale(pulseScale);
  translate(-(startX + barW/2), -(startY + barH/2));

  // Themed Background
  if (typeof BUTTON_BG !== 'undefined' && BUTTON_BG) {
      image(BUTTON_BG, startX - 30, startY - 12, barW + 42, barH + 24);
  } else {
      stroke(0);
      strokeWeight(4);
      fill(20, 20, 20, 180);
      rect(startX - 30, startY - 12, barW + 42, barH + 24, 4);
  }
  
  // Gold Inner Border
  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  noFill();
  rect(startX - 27, startY - 10, barW + 36, barH + 20, 2);

  // Background for the bar
  noStroke();
  fill(60, 20, 20);
  rect(startX, startY, barW, barH, 2);

  // Health Fill
  const hpPct = constrain(playerHealth / maxHealth, 0, 1);
  if (hpPct > 0) {
      fill(220, 40, 40);
      rect(startX, startY, barW * hpPct, barH, 2);
      
      // Glossy highlight
      fill(255, 255, 255, 60);
      rect(startX, startY, barW * hpPct, barH / 2, 2);
  }

  // Draw Heart Icon (If available)
  if (typeof heartImage !== 'undefined' && heartImage) {
      tint(255, 255);
      image(heartImage, startX - 25, startY - 2, 22, 22);
      noTint();
  } else {
      // Fallback heart icon
      fill(255, 50, 50);
      noStroke();
      circle(startX - 14, startY + barH/2, 14);
  }

  // Text
  if (typeof uiFont !== 'undefined' && uiFont) textFont(uiFont);
  fill(255);
  textAlign(CENTER, CENTER);
  noStroke();
  let sz = typeof gTextSize === 'function' ? 12 : 12;
  if (typeof gTextSize === 'function') gTextSize(sz); else textSize(sz);
  text(`${Math.floor(playerHealth)}/${maxHealth}`, startX + barW / 2, startY + barH / 2 + 1);

  pop();
}

function drawManaBar() {
  const startX = 50;
  const startY = 65; // shifted closer to health bar
  const barW = 160;
  const barH = 14;

  push();
  
  // Background Container
  if (typeof BUTTON_BG !== 'undefined' && BUTTON_BG) {
      image(BUTTON_BG, startX - 30, startY - 10, barW + 42, barH + 20);
  } else {
      fill(20, 20, 20, 200);
      stroke(0);
      strokeWeight(4); // consistent border weight
      rect(startX - 30, startY - 10, barW + 42, barH + 20, 4);
  }

  // Border
  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  noFill();
  rect(startX - 27, startY - 8, barW + 36, barH + 16, 2);

  // Background
  noStroke();
  fill(30, 30, 60);
  rect(startX, startY, barW, barH, 2);

  // Use mana max/min
  const mPct = constrain(playerMana / maxMana, 0, 1);
  if (mPct > 0) {
      // Mana fill
      fill(50, 100, 255);
      rect(startX, startY, barW * mPct, barH, 2);
      
      // Glossy highlight
      fill(255, 255, 255, 60);
      rect(startX, startY, barW * mPct, barH / 2, 2);
  }

  // Draw Mana Icon (Simple Blue Bubble)
  fill(50, 150, 255);
  noStroke();
  circle(startX - 14, startY + barH/2, 12);
  fill(255, 255, 255, 100);
  circle(startX - 15, startY + barH/2 - 2, 4);
  
  // Text
  if (typeof uiFont !== 'undefined' && uiFont) textFont(uiFont);
  fill(255);
  textAlign(CENTER, CENTER);
  noStroke();
  let sz = typeof gTextSize === 'function' ? 10 : 10;
  if (typeof gTextSize === 'function') gTextSize(sz); else textSize(sz);
  text(`${Math.floor(playerMana)}/${maxMana}`, startX + barW / 2, startY + barH / 2 + 1);

  pop();
}

function drawBossHealthBar() {
  const boss = (enemies || []).find(e => e.type === 'beetle');
  if (!boss) return;

  const vW = virtualW || (width / gameScale);
  const barW = 400;
  const barH = 20;
  const x = (vW - barW) / 2;
  const y = 40;

  push();
  // Main Container
  fill(0, 180);
  stroke(0);
  strokeWeight(4);
  rect(x - 5, y - 5, barW + 10, barH + 30, 4);

  // Name
  if (uiFont) textFont(uiFont);
  fill(255, 50, 50);
  noStroke();
  textAlign(CENTER, BOTTOM);
  gTextSize(18);
  text(t('boss_name'), x + barW/2, y - 8);

  // Red Glow behind the bar
  noStroke();
  fill(255, 0, 0, 40);
  rect(x, y, barW, barH);

  // Inner Border
  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  noFill();
  rect(x - 2, y - 2, barW + 4, barH + 4, 2);

  // Health Fill
  const hpPct = boss.health / boss.maxHealth;
  fill(200, 0, 0);
  noStroke();
  rect(x, y, barW * hpPct, barH);

  // Animated Highlight
  fill(255, 255, 255, 40);
  rect(x, y, barW * hpPct, barH / 2);
  
  pop();
}

function drawMinimap() {
  if (!showMinimap || !mapImage) return;
  const mmW = 200;
  const mmH = 200;
  const mmX = 20;
  const mmY = (virtualH || height) - mmH - 140; // Shifted up to avoid overlap with sprint meter

  push();
  fill(0, 0, 0, 180);
  stroke(MENU_GOLD_BORDER);
  strokeWeight(3);
  rect(mmX, mmY, mmW, mmH, 4);
  noStroke();

  const mapAspect = mapImage.width / mapImage.height;
  let drawW = mmW;
  let drawH = mmW / mapAspect;
  if (drawH > mmH) {
    drawH = mmH;
    drawW = mmH * mapAspect;
  }
  const offX = (mmW - drawW) / 2;
  const offY = (mmH - drawH) / 2;

  tint(255, 230);
  if (minimapImage) {
    image(minimapImage, mmX + offX, mmY + offY, drawW, drawH);
  } else {
    image(mapImage, mmX + offX, mmY + offY, drawW, drawH);
  }
  noTint();

  if (treeObjects && logicalW && logicalH) {
    fill(15, 70, 15);
    stroke(0, 150);
    strokeWeight(1);
    for (const tr of treeObjects) {
      const pxRel = tr.x / logicalW;
      const pyRel = tr.y / logicalH;
      circle(mmX + offX + (pxRel * drawW), mmY + offY + (pyRel * drawH), 4);
    }
  }

  if (portalPos) {
    fill(isPortalActive ? [180, 50, 255] : [100, 100, 100]); // Purple when active to match compass
    stroke(0, 150);
    strokeWeight(1);
    const px = mmX + offX + (portalPos.x / logicalW * drawW);
    const py = mmY + offY + (portalPos.y / logicalH * drawH);
    rect(px - 3, py - 3, 6, 6);
  }

  // Draw Enemies on Minimap (Red Dots)
  if (typeof enemies !== 'undefined' && enemies && enemies.length > 0 && logicalW && logicalH) {
    fill(255, 50, 50); // Red
    stroke(0, 150);
    strokeWeight(1);
    for (const e of enemies) {
      const px = mmX + offX + (e.x / logicalW * drawW);
      const py = mmY + offY + (e.y / logicalH * drawH);
      circle(px, py, 4);
    }
  }

  // Draw Coins on Minimap (Gold Dots)
  if (typeof mapStates !== 'undefined' && mapStates && typeof TILE_TYPES !== 'undefined' && logicalW && logicalH) {
    fill(255, 215, 0); // Gold
    stroke(0, 150);
    strokeWeight(1);
    for (let i = 0; i < mapStates.length; i++) {
        if (mapStates[i] === TILE_TYPES.COIN) {
            const cx = i % logicalW;
            const cy = Math.floor(i / logicalW);
            const px = mmX + offX + (cx / logicalW * drawW);
            const py = mmY + offY + (cy / logicalH * drawH);
            circle(px, py, 3);
        }
    }
  }

  if (playerPosition) {
    const pX = isMoving ? renderX : playerPosition.x;
    const pY = isMoving ? renderY : playerPosition.y;
    const markerX = mmX + offX + (pX / logicalW * drawW);
    const markerY = mmY + offY + (pY / logicalH * drawH);
    const angle = DIRECTION_TO_ANGLE_MAP[lastDirection || 'S'] ?? HALF_PI;
    push();
    translate(markerX, markerY);
    rotate(angle);
    fill(255);
    stroke(0, 0, 0, 150);
    strokeWeight(1);
    beginShape();
    vertex(5, 0); vertex(-4, -4); vertex(-2, 0); vertex(-4, 4);
    endShape(CLOSE);
    pop();
  }
  pop();
}

function drawScore() {
  const x = 30;
  const y = 105; // Shifted up due to compact health/mana bars
  
  push();
  
  // UI Pulse Effect
  const now = millis();
  let pulseScale = 1.0;
  if (now - lastScoreChange < 200) {
      pulseScale = map(now - lastScoreChange, 0, 200, 1.2, 1.0);
  }
  
  translate(x + 70, y - 5);
  scale(pulseScale);
  translate(-(x + 70), -(y - 5));

  if (uiFont) textFont(uiFont);
  
  // Outer Border
  stroke(0, 100);
  strokeWeight(4);
  fill(0, 150);
  rect(x - 5, y - 20, 140, 30, 5);
  
  // Inner Border
  stroke(255, 215, 0); // GOLD
  strokeWeight(2);
  noFill();
  rect(x - 3, y - 18, 136, 26, 3);
  
  // Text
  noStroke();
  fill(255, 255, 255);
  textSize(16);
  textAlign(LEFT, CENTER);
  text(t('gold_hud', playerScore), x + 5, y - 5);
  pop();
}

function drawInventory() {
  if (!playerInventory) return;
  const potions = playerInventory['potion'] || 0;
  const speeds = playerInventory['speed'] || 0;
  if (potions === 0 && speeds === 0) return;

  const startX = 30;
  const startY = 130; // Shifted up alongside score
  const slotW = 48;
  const slotH = 48;
  const slotSpacing = 8;
  const slots = [];

  if (potions > 0) slots.push({ label: 'P', count: potions, col: [0, 200, 80] });
  if (speeds > 0) slots.push({ label: 'S', count: speeds, col: [0, 210, 240] });

  const containerW = slots.length * (slotW + slotSpacing) + slotSpacing + 10;
  const containerH = slotH + 20;

  push();
  if (BUTTON_BG) {
    image(BUTTON_BG, startX - 8, startY - 8, containerW, containerH);
  } else {
    stroke(0);
    strokeWeight(4);
    fill(20, 20, 20, 180);
    rect(startX - 8, startY - 8, containerW, containerH, 4);
  }
  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  noFill();
  rect(startX - 5, startY - 5, containerW - 6, containerH - 6, 2);

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const sx = startX + i * (slotW + slotSpacing);
    const sy = startY;

    // Slot background
    noStroke();
    fill(0, 0, 0, 120);
    rect(sx, sy, slotW, slotH, 3);

    // Item indicator
    fill(s.col[0], s.col[1], s.col[2]);
    noStroke();
    ellipse(sx + slotW / 2, sy + slotH / 2 - 4, 20, 20);

    // Count
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    if (typeof gTextSize === 'function') gTextSize(14); else textSize(14);
    text('x' + s.count, sx + slotW / 2, sy + slotH - 8);

    // Key hint
    fill(200, 200, 200, 180);
    if (typeof gTextSize === 'function') gTextSize(10); else textSize(10);
    text('[' + s.label + ']', sx + slotW / 2, sy + 6);
  }
  pop();
}

function drawVignette() {
    push();
    // vW and vH are strictly the physical canvas dimensions since it is drawn after pop()
    const vW = width;
    const vH = height;
    
    // Use a large radial gradient via native canvas context for performance
    const ctx = drawingContext;
    const centerX = vW / 2;
    const centerY = vH / 2;
    const outerRadius = Math.max(vW, vH) * 0.8;
    const innerRadius = Math.min(vW, vH) * 0.2;

    const grad = ctx.createRadialGradient(
        centerX, centerY, innerRadius,
        centerX, centerY, outerRadius
    );
    
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)'); // Subtle dark edges

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vW, vH);
    pop();
}

function drawDifficultyBadge() {
  const vW = virtualW || (width / gameScale);
  const margin = 180; // Shifted left to accommodate the clock
  const badgeSize = 32;
  const x = vW - margin - badgeSize;
  const y = 30; // Slightly lower for better visibility
  
  // Determine color based on difficulty
  let badgeColor;
  let diff = (currentDifficulty || 'normal').toLowerCase();
  if (diff === 'easy') badgeColor = color(205, 127, 50); // Bronze
  else if (diff === 'hard') badgeColor = color(255, 215, 0); // Gold
  else badgeColor = color(192, 192, 192); // Silver (Normal)

  push();
  
  // Draw Shield/Badge Background
  stroke(0, 0, 0, 150);
  strokeWeight(2);
  fill(badgeColor);
  
  // Simple Shield Shape
  beginShape();
  vertex(x, y);
  vertex(x + badgeSize, y);
  vertex(x + badgeSize, y + badgeSize * 0.8);
  vertex(x + badgeSize / 2, y + badgeSize * 1.2);
  vertex(x, y + badgeSize * 0.8);
  endShape(CLOSE);

  // Inner detail
  noStroke();
  fill(255, 255, 255, 60);
  circle(x + badgeSize/2, y + badgeSize*0.4, badgeSize/3);

  // Interaction: Show text on hover
  const mx = mouseX / gameScale;
  const my = mouseY / gameScale;
  const isHover = mx >= x && mx <= x + badgeSize && my >= y && my <= y + badgeSize * 1.2;

  if (isHover) {
    const label = `Difficulty: ${getDifficultyDisplayLabel()}`;
    if (uiFont) textFont(uiFont);
    gTextSize(16);
    const tW = textWidth(label);
    
    // Tooltip bg
    fill(0, 0, 0, 220);
    noStroke();
    rect(x - tW - 10, y, tW + 8, 24, 4);
    
    // Text
    fill(255);
    textAlign(RIGHT, CENTER);
    text(label, x - 6, y + 12);
  }

  pop();
}

function findGoalPosition() {
    if (!decorativeObjectsList) return null;
    for (const obj of decorativeObjectsList) {
        if (obj.type === 'special' && obj.id === 'hole_1') {
            return { x: obj.tileX, y: obj.tileY };
        }
    }
    return null;
}

function drawSprintMeter() {
  const vW = virtualW || (width / gameScale);
  const vH = virtualH || (height / gameScale);
  const now = millis();
  
  const pct = (typeof smoothSprintPct === 'number') ? smoothSprintPct : 0;
  const maxDur = typeof playerMaxStamina !== 'undefined' ? playerMaxStamina * 30 : 3000;
  const actualPct = (typeof sprintRemainingMs === 'number' && maxDur > 0) ? (sprintRemainingMs / maxDur) : 0;
  lerpedSprintPct = lerp(lerpedSprintPct, smoothSprintPct, 0.2);
  // Show the bar if active, or not full, or in cooldown
  let targetAlpha = 0;
  if (sprintActive || actualPct < 0.99 || (sprintCooldownUntil > now)) {
    targetAlpha = 255;
  }
  
  if (targetAlpha === 0) return;

  // Positioning: Bottom-Left
  const startX = 30; 
  const startY = vH - 100; 
  const barW = 160;   
  const barH = 10;    
  
  const containerW = 200; 
  const containerH = 32;

  push();
  
  // Themed Background Container
  if (typeof BUTTON_BG !== 'undefined' && BUTTON_BG) {
      tint(255, targetAlpha);
      image(BUTTON_BG, startX - 10, startY - 8, containerW + 20, containerH + 16);
      noTint();
  } else {
      stroke(0);
      strokeWeight(4);
      fill(20, 20, 20, 200 * (targetAlpha / 255));
      rect(startX - 10, startY - 8, containerW + 20, containerH + 16, 4);
  }
  
  // Gold Inner Border
  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  noFill();
  rect(startX - 7, startY - 5, containerW + 14, containerH + 10, 2);

  // Bar Background (empty part)
  noStroke();
  fill(30, 30, 40, targetAlpha);
  rect(startX + 30, startY + 11, barW, barH, 2);

  // Bar Fill
  if (pct > 0.005) {
    // Stamina Gradient: Cyan to Deep Blue
    let r = map(actualPct, 0, 1, 0, 100);
    let g = map(actualPct, 0, 1, 150, 255);
    let b = map(actualPct, 0, 1, 200, 255);
    
    // Smooth pulse when sprinting
    let alphaPulse = targetAlpha;
    if (sprintActive) {
      alphaPulse = targetAlpha * (0.7 + 0.3 * Math.sin(now * 0.015));
    }
    
    fill(r, g, b, alphaPulse);
    rect(startX + 30, startY + 11, barW * pct, barH, 2);
    
    // Glossy highlight
    fill(255, 255, 255, 50 * (targetAlpha / 255));
    rect(startX + 30, startY + 11, barW * pct, barH / 2, 2);
  }

  // Cooldown Overlay (stamina flashing red)
  if (typeof sprintCooldownUntil === 'number' && now < sprintCooldownUntil) {
    if (Math.floor(now / 150) % 2 === 0) {
        fill(255, 50, 50, 120 * (targetAlpha / 255));
        rect(startX + 30, startY + 11, barW, barH, 2);
    }
  }

  // Icon (Energy/Lightning)
  const ix = startX + 12;
  const iy = startY + containerH / 2 + 3;
  noStroke();
  
  if (sprintActive) {
    fill(100, 255, 255, targetAlpha); // Bright Cyan
  } else if (now < sprintCooldownUntil) {
    fill(255, 100, 100, targetAlpha); // Red
  } else {
    fill(180, 200, 255, targetAlpha); // Soft Blue
  }
  
  // Lightning Bolt Shape
  beginShape();
  vertex(ix, iy - 10); 
  vertex(ix + 6, iy - 10); 
  vertex(ix - 2, iy); 
  vertex(ix + 4, iy); 
  vertex(ix - 4, iy + 10); 
  vertex(ix, iy); 
  vertex(ix - 6, iy);
  endShape(CLOSE);

  pop();
}

function findNearestCoin(px, py) {
    if (!mapStates || !logicalW || !logicalH) return null;
    let nearest = null;
    let minDist = Infinity;
    for (let i = 0; i < mapStates.length; i++) {
        if (mapStates[i] === TILE_TYPES.COIN) {
            const cx = i % logicalW;
            const cy = Math.floor(i / logicalW);
            const d = Math.hypot(cx - px, cy - py);
            if (d < minDist) {
                minDist = d;
                nearest = { x: cx, y: cy };
            }
        }
    }
    return nearest;
}

function drawCompass() {
    if (!playerPosition) return;
    
    const vW = virtualW || (width / gameScale);
    const vH = virtualH || (height / gameScale);
    const camX = Math.floor(smoothCamX || 0);
    const camY = Math.floor(smoothCamY || 0);
    const pX = isMoving ? renderX : playerPosition.x;
    const pY = isMoving ? renderY : playerPosition.y;
    const pScreenX = (pX * cellSize + cellSize / 2) - camX;
    const pScreenY = (pY * cellSize + cellSize / 2) - camY;

    const activeMarkers = [];

    // Find nearest coin
    const nearestCoin = findNearestCoin(pX, pY);
    if (nearestCoin) activeMarkers.push({ x: nearestCoin.x, y: nearestCoin.y, type: 'coin', label: 'COIN' });

    // Find nearest enemy
    if (enemies && enemies.length > 0) {
        let nearestE = null, minDistE = Infinity;
        for (const e of enemies) {
            const d = Math.hypot(e.x - pX, e.y - pY);
            if (d < minDistE) { minDistE = d; nearestE = e; }
        }
        if (nearestE) activeMarkers.push({ x: nearestE.x, y: nearestE.y, type: 'enemy', label: 'ENEMY' });
    }

    // Portal
    if (isPortalActive && portalPos) {
        activeMarkers.push({ x: portalPos.x, y: portalPos.y, type: 'portal', label: 'PORTAL' });
    }

    activeMarkers.forEach((m, i) => {
        const tScreenX = (m.x * cellSize + cellSize / 2) - camX;
        const tScreenY = (m.y * cellSize + cellSize / 2) - camY;
        const padding = 60;
        
        // If on screen, skip pointer
        if (tScreenX > padding && tScreenX < vW - padding && tScreenY > padding && tScreenY < vH - padding) return;

        const dx = tScreenX - pScreenX;
        const dy = tScreenY - pScreenY;
        const distTiles = Math.hypot(dx, dy) / cellSize;
        const angle = atan2(dy, dx);
        
        const margin = 35 + (i * 5); // Slight offset for multiple markers
        let tMin = Infinity;
        if (dx > 0) tMin = Math.min(tMin, (vW - margin - pScreenX) / dx);
        if (dx < 0) tMin = Math.min(tMin, (margin - pScreenX) / dx);
        if (dy > 0) tMin = Math.min(tMin, (vH - margin - pScreenY) / dy);
        if (dy < 0) tMin = Math.min(tMin, (margin - pScreenY) / dy);
        
        const edgeX = constrain(pScreenX + dx * tMin, margin, vW - margin);
        const edgeY = constrain(pScreenY + dy * tMin, margin, vH - margin);

        let markerColor;
        if (m.type === 'enemy') markerColor = color(255, 50, 50);
        else if (m.type === 'coin') markerColor = color(255, 215, 0);
        else if (m.type === 'portal') markerColor = color(180, 50, 255);

        const alpha = map(sin(millis() / 200), -1, 1, 180, 255);
        
        push();
        translate(edgeX, edgeY);
        rotate(angle);
        
        // Arrow Shadow
        fill(0, 100);
        noStroke();
        beginShape();
        vertex(22, 2); vertex(-8, -12); vertex(2, 2); vertex(-8, 12);
        endShape(CLOSE);

        // Arrow Fill
        fill(markerColor.levels[0], markerColor.levels[1], markerColor.levels[2], alpha);
        stroke(0, alpha * 0.8);
        strokeWeight(2);
        beginShape();
        vertex(20, 0); vertex(-10, -14); vertex(0, 0); vertex(-10, 14);
        endShape(CLOSE);
        
        rotate(-angle);
        noStroke(); 
        if (uiFont) textFont(uiFont);
        
        // Label (COIN/ENEMY/PORTAL)
        textAlign(CENTER, BOTTOM);
        textSize(10);
        fill(0, 180);
        text(m.label, 1, -19); // Shadow
        fill(markerColor);
        text(m.label, 0, -20);

        // Distance
        textAlign(CENTER, TOP);
        textSize(12);
        fill(0, 180);
        text(Math.round(distTiles) + "m", 1, 21); // Shadow
        fill(255);
        text(Math.round(distTiles) + "m", 0, 20);
        pop();
    });
}

function locatePortal() {
    if (portalPos) {
        verboseLog(`[debug] Portal is at Tile: ${portalPos.x}, ${portalPos.y}`);
        return portalPos;
    } else {
        verboseLog('[debug] No portal spawned yet.');
        return null;
    }
}

function spawnCloud(forceX) {
  if (clouds.length >= MAX_CLOUDS) return;
  
  const validImages = cloudImages.filter(img => img);
  if (validImages.length === 0) return;
  
  const cloudImg = validImages[Math.floor(Math.random() * validImages.length)];
  
  // Use map coordinates (world space)
  const mapW = (logicalW || 150) * cellSize;
  const mapH = (logicalH || 150) * cellSize;
  
  const minY = -cellSize * 5; 
  const maxY = mapH + cellSize * 5; 
  const yPos = minY + Math.random() * (maxY - minY);

  const baseSpeed = 0.3 + Math.random() * 1;
  const scale = 2.0 + Math.random() * 4.0;
  
  // Spawn left of map if no forceX provided
  const startX = (typeof forceX === 'number') ? forceX : -cloudImg.width * scale - 200;

  clouds.push({
    img: cloudImg,
    x: startX,
    y: yPos,
    baseY: yPos,
    speed: baseSpeed,
    scale: scale,
    opacity: 180 + Math.random() * 75,
    verticalDrift: (Math.random() - 0.5) * 0.15,
    driftPhase: Math.random() * Math.PI * 2
  });
  // Keep clouds sorted by scale (painter's order) — cheapest to sort on insert
  clouds.sort((a, b) => a.scale - b.scale);
}

function updateClouds() {
  const now = millis();
  
  if (now - lastCloudSpawn > CLOUD_SPAWN_INTERVAL) {
    spawnCloud();
    lastCloudSpawn = now;
  }
  
  
  // Use map coordinates (world space)
  const mapW = (logicalW || 150) * cellSize;

  for (let i = clouds.length - 1; i >= 0; i--) {
    const cloud = clouds[i];
    
    // Normalize speed to ~60fps (16.67ms)
    const dtScale = gameDelta / FRAME_TIME_MS;
    cloud.x += cloud.speed * dtScale;
    cloud.driftPhase += 0.01 * dtScale;
    cloud.y = cloud.baseY + Math.sin(cloud.driftPhase) * 20 * (cloud.verticalDrift || 0.1);
    
   
    const cloudWidth = cloud.img.width * cloud.scale;
    if (cloud.x > mapW + 500) {
      clouds.splice(i, 1);
    }
  }
}

function drawClouds() {
  push();
  // Weather tint
  let tintColor = [255, 255, 255, 255];
  if (typeof WeatherSystem !== 'undefined') {
      tintColor = WeatherSystem.getCloudTint();
  }

  for (const cloud of clouds) {
    push();
    // Combine cloud's own alpha with weather tint
    tint(tintColor[0], tintColor[1], tintColor[2], Math.min(tintColor[3], cloud.opacity));
    imageMode(CORNER);
    
    const w = cloud.img.width * cloud.scale;
    const h = cloud.img.height * cloud.scale;
    
    image(cloud.img, cloud.x, cloud.y, w, h);
    pop();
  }
  
  noTint();
  pop();
}




window.locatePortal = locatePortal;

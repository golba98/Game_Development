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

const HUD_EDGE_MARGIN = 24;
const HUD_PANEL_GAP = 10;
let cachedHudLayoutFrame = -1;
let cachedHudLayout = null;
let cachedHudLayoutKey = "";
let cachedCloudImagesSourceCount = -1;
let cachedUsableCloudImages = [];

// Minimap enemy/coin marker cache — recomputed at ~10 Hz instead of every frame.
const _MINIMAP_MARKER_INTERVAL = 6; // frames between recomputes
let _mmMarkerFrame = -100;           // frameCount when markers were last recomputed
let _mmCachedEnemyDots = [];         // flat [px0,py0, px1,py1, ...] pairs
let _mmCachedCoinDots = [];
let _mmCacheDrawW = -1;              // layout dimensions when cache was built
let _mmCacheDrawH = -1;

function getHudUiScale() {
  const vW = virtualW || (width / gameScale);
  const vH = virtualH || (height / gameScale);
  const viewportScale = Math.max(0.9, Math.min(1.1, Math.min(vW / 1280, vH / 720) || 1));
  return Math.max(0.85, Math.min(1.3, getUiScaleMultiplier(textSizeSetting) * viewportScale));
}

function getHudSafeArea(vW, vH, uiScaleFactor) {
  const margin = Math.round(HUD_EDGE_MARGIN * uiScaleFactor);
  const left = margin;
  const top = margin;
  const right = Math.max(left, vW - margin);
  const bottom = Math.max(top, vH - margin);

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    margin,
    gap: Math.round(HUD_PANEL_GAP * uiScaleFactor),
  };
}

function clampHudRect(x, y, w, h, safeArea, extraPad = 0) {
  const pad = Math.max(0, Number(extraPad) || 0);
  const minX = safeArea.left + pad;
  const minY = safeArea.top + pad;
  const maxX = Math.max(minX, safeArea.right - pad - w);
  const maxY = Math.max(minY, safeArea.bottom - pad - h);

  return {
    x: constrain(x, minX, maxX),
    y: constrain(y, minY, maxY),
    w,
    h,
  };
}

function getHudLayout() {
  const vW = virtualW || (width / gameScale);
  const vH = virtualH || (height / gameScale);
  const uiScaleFactor = getHudUiScale();
  const layoutKey = [
    Math.round(vW),
    Math.round(vH),
    Math.round(uiScaleFactor * 1000),
    textSizeSetting || "",
    showMinimap ? 1 : 0,
    performanceOverlayEnabled ? 1 : 0,
  ].join("|");
  if (cachedHudLayout && cachedHudLayoutKey === layoutKey) {
    return cachedHudLayout;
  }

  const safeArea = getHudSafeArea(vW, vH, uiScaleFactor);
  const margin = safeArea.margin;
  const gap = safeArea.gap;

  // --- Layout Constants (Amended) ---
  const HUD_MARGIN = Math.round(28 * uiScaleFactor);
  const HUD_GAP = Math.round(10 * uiScaleFactor);
  const HUD_GAP_SMALL = Math.round(4 * uiScaleFactor);

  const statBarW = Math.round(Math.max(1, Math.min(184 * uiScaleFactor, safeArea.width - 56 * uiScaleFactor)));
  const perfPad = Math.round(10 * uiScaleFactor);
  const perfSize = getPerformanceOverlaySize(uiScaleFactor, safeArea.width - perfPad * 2);
  const perfRect = clampHudRect(
    safeArea.right - perfSize.width - perfPad,
    safeArea.top + perfPad,
    perfSize.width,
    perfSize.height,
    safeArea,
    perfPad,
  );

  // --- Top-Left Player Stats (Height-Based Stack) ---
  // Health Shell Y calculations
  const healthBarH = Math.round(Math.max(16, 18 * uiScaleFactor));
  const healthPadY = Math.round(10 * uiScaleFactor);
  const healthShellHeight = healthBarH + healthPadY * 2;
  const healthShellY = HUD_MARGIN;
  const healthY = Math.round(healthShellY + healthPadY);

  // Mana Shell Y calculations
  const manaBarH = Math.round(Math.max(12, 14 * uiScaleFactor));
  const manaPadY = Math.round(8 * uiScaleFactor);
  const manaShellHeight = manaBarH + manaPadY * 2;
  const manaShellY = Math.round(healthShellY + healthShellHeight + HUD_GAP_SMALL);
  const manaY = Math.round(manaShellY + manaPadY);

  // Gold Shell Y calculations
  const goldShellHeight = Math.round(32 * uiScaleFactor);
  const goldShellY = Math.round(manaShellY + manaShellHeight + HUD_GAP_SMALL);
  const scoreY = Math.round(goldShellY + 20 * uiScaleFactor);

  // Inventory Shell Y calculations
  const inventoryShellY = Math.round(goldShellY + goldShellHeight + HUD_GAP);
  const inventoryY = Math.round(inventoryShellY + 8 * uiScaleFactor);

  // --- Right-Side Layout (Vertical Column) ---
  const rightColumnRight = Math.round(vW - HUD_MARGIN);
  const clockRadius = Math.round(22 * uiScaleFactor);
  const minimapPad = Math.min(Math.round(8 * uiScaleFactor), Math.max(0, Math.floor((safeArea.width - 1) / 2)));
  const availableRightHeight = Math.max(48, safeArea.bottom - (perfRect.y + perfSize.height + gap) - minimapPad);
  const minimapSize = Math.round(Math.min(168 * uiScaleFactor, safeArea.width * 0.24, availableRightHeight * 0.72));

  // Height of top right widget area above minimap
  const topRightWidgetHeight = Math.round(Math.max(32 * uiScaleFactor * 1.2, 22 * uiScaleFactor * 2));
  const minimapX = Math.round(rightColumnRight - minimapSize);
  const minimapY = Math.round(HUD_MARGIN + topRightWidgetHeight + HUD_GAP);

  const minimapRect = clampHudRect(
    minimapX,
    minimapY,
    minimapSize,
    minimapSize,
    safeArea,
    minimapPad,
  );

  // --- Top-Center Boss Bar (Responsive Fallback) ---
  const bossPadX = Math.min(Math.round(14 * uiScaleFactor), Math.max(0, Math.floor((safeArea.width - 1) / 2)));
  const bossPadY = Math.round(11 * uiScaleFactor);
  let bossBarW = Math.round(Math.max(1, Math.min(safeArea.width - bossPadX * 2, safeArea.width * 0.34, 360 * uiScaleFactor)));
  const bossBarH = Math.round(Math.max(14, 16 * uiScaleFactor));

  // Determine clear space between top-left cluster and right column
  const leftStatsRight = Math.round(HUD_MARGIN + statBarW + 56 * uiScaleFactor);
  const rightColumnLeft = Math.round(vW - HUD_MARGIN - minimapSize);
  const centerSpace = Math.round(rightColumnLeft - leftStatsRight);
  const safetyMargin = Math.round(20 * uiScaleFactor);

  // Responsive fallback logic
  let bossYCoord = Math.round(48 * uiScaleFactor);
  if (bossBarW + bossPadX * 2 > centerSpace - safetyMargin) {
    const maxFittingWidth = centerSpace - safetyMargin - bossPadX * 2;
    bossBarW = Math.round(Math.max(180 * uiScaleFactor, maxFittingWidth));
  }
  // If screen is narrow or they still collide, push the boss bar below top-left stats
  if (vW < Math.round(850 * uiScaleFactor) || (bossBarW + bossPadX * 2 > centerSpace - safetyMargin)) {
    bossYCoord = Math.round(HUD_MARGIN + 130 * uiScaleFactor);
  }

  const bossShell = clampHudRect(
    Math.round((vW - (bossBarW + bossPadX * 2)) / 2),
    Math.round(bossYCoord - bossPadY),
    Math.round(bossBarW + bossPadX * 2),
    Math.round(bossBarH + bossPadY * 2),
    safeArea,
  );

  // --- XP & Level Bar (Raised Bottom-Center) ---
  const xpPadX = Math.min(Math.round(18 * uiScaleFactor), Math.max(0, Math.floor((safeArea.width - 1) / 2)));
  const xpPadY = Math.round(12 * uiScaleFactor);
  const xpBarW = Math.max(1, Math.min(safeArea.width - xpPadX * 2, safeArea.width * 0.58, Math.round(440 * uiScaleFactor)));
  const xpBarH = Math.max(12, Math.round(12 * uiScaleFactor));
  const xpPanelW = xpBarW + xpPadX * 2;
  const xpPanelH = xpBarH + xpPadY * 2;
  const xpPulsePad = Math.ceil(xpPanelH * 0.05);
  const xpShell = clampHudRect(
    Math.round((vW - xpPanelW) / 2),
    Math.round(vH - HUD_MARGIN - xpPanelH - 8 * uiScaleFactor),
    xpPanelW,
    xpPanelH,
    safeArea,
    xpPulsePad,
  );

  // --- Stamina Meter (Bottom-Left) ---
  const sprintPadY = Math.round(8 * uiScaleFactor);
  const sprintContainerW = Math.max(1, Math.min(Math.round(200 * uiScaleFactor), safeArea.width - Math.round(20 * uiScaleFactor)));
  const sprintContainerH = Math.round(32 * uiScaleFactor);
  const sprintShell = clampHudRect(
    HUD_MARGIN,
    Math.round(vH - HUD_MARGIN - (sprintContainerH + sprintPadY * 2)),
    Math.round(sprintContainerW + 20 * uiScaleFactor),
    Math.round(sprintContainerH + sprintPadY * 2),
    safeArea,
  );

  const statX = Math.round(HUD_MARGIN + 28 * uiScaleFactor);

  cachedHudLayoutFrame = typeof frameCount === 'number' ? frameCount : -1;
  cachedHudLayoutKey = layoutKey;
  cachedHudLayout = {
    vW: Math.round(vW),
    vH: Math.round(vH),
    uiScaleFactor,
    safeArea,
    margin,
    gap,
    HUD_MARGIN,
    HUD_GAP,
    HUD_GAP_SMALL,
    statBarW,
    statX,
    healthY: Math.round(healthY),
    manaY: Math.round(manaY),
    scoreY: Math.round(scoreY),
    inventoryY: Math.round(inventoryY),
    sprintY: Math.round(sprintShell.y + sprintPadY),
    sprintContainerW,
    bossX: Math.round(bossShell.x + bossPadX),
    bossY: Math.round(bossShell.y + bossPadY),
    bossBarW,
    bossBarH,
    bossPadX,
    bossPadY,
    xpX: Math.round(xpShell.x + xpPadX),
    xpY: Math.round(xpShell.y + xpPadY),
    xpBarW,
    xpBarH,
    xpPadX,
    xpPadY,
    minimapSize,
    minimapX: Math.round(minimapRect.x),
    minimapY: Math.round(minimapRect.y),
    perfX: Math.round(perfRect.x),
    perfY: Math.round(perfRect.y),
    perfSize,
    difficultyX: Math.round(minimapX),
    difficultyY: Math.round(HUD_MARGIN + 4 * uiScaleFactor),
    clockX: Math.round(rightColumnRight - clockRadius),
    clockY: Math.round(HUD_MARGIN + clockRadius),
  };
  return cachedHudLayout;
}

function drawHudPanelShell(x, y, w, h, opts = {}) {
  const padX = opts.padX ?? 10;
  const padY = opts.padY ?? 8;

  if (typeof BUTTON_BG !== 'undefined' && BUTTON_BG) {
    image(BUTTON_BG, x - padX, y - padY, w + padX * 2, h + padY * 2);
  } else {
    stroke(0);
    strokeWeight(4);
    fill(20, 20, 20, opts.alpha ?? 190);
    rect(x - padX, y - padY, w + padX * 2, h + padY * 2, 4);
  }

  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  noFill();
  rect(x - Math.max(4, padX - 3), y - Math.max(3, padY - 2), w + Math.max(8, (padX - 3) * 2), h + Math.max(6, (padY - 2) * 2), 2);
}

function drawHudPerformanceOverlay() {
  const layout = getHudLayout();
  drawPerformanceOverlayPanel({
    x: layout.perfX,
    y: layout.perfY,
    tracker: performanceTracker,
    targetFps,
    fpsMode: normalizeFpsMode(targetFps),
    uiScaleFactor: layout.uiScaleFactor,
    maxWidth: layout.safeArea.width - Math.round(20 * layout.uiScaleFactor),
  });
}

function drawBottomHud() {
  drawXPBar();
}

function drawBossHud() {
  drawBossHealthBar();
}

function drawLeftHud() {
  drawHealthBar();
  drawManaBar();
  drawSprintMeter();
  drawInventory();
  drawScore();
}

function drawRightHud(opts = {}) {
  const includeHud = opts.includeHud !== false;
  if (includeHud) {
    drawDifficultyBadge();
    if (showMinimap) drawMinimap();
    if (typeof drawHudWeatherClock === "function") drawHudWeatherClock();
  }
  if (opts.includePerformance) {
    drawHudPerformanceOverlay();
  }
}

function drawXPBar() {
  const layout = getHudLayout();
  const barW = layout.xpBarW;
  const barH = layout.xpBarH;
  const startX = layout.xpX;
  const startY = layout.xpY;

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
  drawHudPanelShell(startX, startY, barW, barH, { padX: layout.xpPadX, padY: layout.xpPadY, alpha: 200 });

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
  text(`Lv ${playerLevel} (${playerXP}/${xpToNextLevel})`, startX + barW/2, startY - Math.round(18 * layout.uiScaleFactor));

  // Stat points indicator
  if (statPoints > 0) {
      fill(255, 215, 0); // Gold for available stat points
      text(`+${statPoints} Stat Points (Press I)`, startX + barW/2, startY - Math.round(36 * layout.uiScaleFactor));
  }

  pop();
}

function drawHealthBar() {
  const layout = getHudLayout();
  const startX = layout.statX;
  const startY = layout.healthY;
  const barW = layout.statBarW;
  const barH = Math.max(16, Math.round(18 * layout.uiScaleFactor));

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
  drawHudPanelShell(startX, startY, barW, barH, { padX: Math.round(28 * layout.uiScaleFactor), padY: Math.round(10 * layout.uiScaleFactor), alpha: 180 });

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
      image(heartImage, startX - Math.round(24 * layout.uiScaleFactor), startY - Math.round(2 * layout.uiScaleFactor), Math.round(22 * layout.uiScaleFactor), Math.round(22 * layout.uiScaleFactor));
      noTint();
  } else {
      // Fallback heart icon
      fill(255, 50, 50);
      noStroke();
      circle(startX - Math.round(14 * layout.uiScaleFactor), startY + barH/2, Math.round(14 * layout.uiScaleFactor));
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
  const layout = getHudLayout();
  const startX = layout.statX;
  const startY = layout.manaY;
  const barW = layout.statBarW;
  const barH = Math.max(12, Math.round(14 * layout.uiScaleFactor));

  push();

  // Background Container
  drawHudPanelShell(startX, startY, barW, barH, { padX: Math.round(28 * layout.uiScaleFactor), padY: Math.round(8 * layout.uiScaleFactor), alpha: 200 });

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
  circle(startX - Math.round(14 * layout.uiScaleFactor), startY + barH/2, Math.round(12 * layout.uiScaleFactor));
  fill(255, 255, 255, 100);
  circle(startX - Math.round(15 * layout.uiScaleFactor), startY + barH/2 - Math.round(2 * layout.uiScaleFactor), Math.round(4 * layout.uiScaleFactor));

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

  const layout = getHudLayout();
  const barW = layout.bossBarW;
  const barH = layout.bossBarH;
  const x = layout.bossX;
  const y = layout.bossY;

  push();
  drawHudPanelShell(x, y, barW, barH, {
    padX: layout.bossPadX,
    padY: layout.bossPadY,
    alpha: 190,
  });

  if (uiFont) textFont(uiFont);
  fill(255, 180, 145);
  noStroke();
  textAlign(CENTER, BOTTOM);
  gTextSize(Math.round(12 * layout.uiScaleFactor));
  text(t('boss_name'), x + barW/2, y - Math.round(6 * layout.uiScaleFactor));

  noStroke();
  fill(36, 12, 14, 235);
  rect(x, y, barW, barH, 2);

  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  noFill();
  rect(x - 1, y - 1, barW + 2, barH + 2, 2);

  const hpPct = constrain(boss.health / boss.maxHealth, 0, 1);
  fill(190, 34, 34);
  noStroke();
  rect(x + 2, y + 2, Math.max(0, (barW - 4) * hpPct), barH - 4, 1);

  fill(255, 255, 255, 34);
  rect(x + 2, y + 2, Math.max(0, (barW - 4) * hpPct), Math.max(2, (barH - 4) / 2), 1);

  pop();
}

function drawMinimap() {
  if (!showMinimap || !mapImage) return;
  const layout = getHudLayout();
  const mmW = layout.minimapSize;
  const mmH = layout.minimapSize;
  const mmX = layout.minimapX;
  const mmY = layout.minimapY;

  push();
  drawHudPanelShell(mmX, mmY, mmW, mmH, { padX: Math.round(8 * layout.uiScaleFactor), padY: Math.round(8 * layout.uiScaleFactor), alpha: 180 });
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

  const minimapComposite =
    typeof HudCache !== "undefined" && HudCache.getMinimapComposite
      ? HudCache.getMinimapComposite({ mmW, mmH, drawW, drawH, offX, offY })
      : null;
  if (minimapComposite) {
    image(minimapComposite, mmX, mmY, mmW, mmH);
  } else {
    tint(255, 230);
    image(minimapImage || mapImage, mmX + offX, mmY + offY, drawW, drawH);
    noTint();
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
  const layout = getHudLayout();
  const goldShellX = layout.HUD_MARGIN;
  const goldShellW = Math.round(150 * layout.uiScaleFactor);
  const y = layout.scoreY;

  push();

  // UI Pulse Effect
  const now = millis();
  let pulseScale = 1.0;
  if (now - lastScoreChange < 200) {
      pulseScale = map(now - lastScoreChange, 0, 200, 1.2, 1.0);
  }

  const centerX = goldShellX + goldShellW / 2;
  const centerY = y - Math.round(5 * layout.uiScaleFactor);

  translate(centerX, centerY);
  scale(pulseScale);
  translate(-centerX, -centerY);

  if (uiFont) textFont(uiFont);

  // Outer Border
  stroke(0, 100);
  strokeWeight(4);
  fill(0, 150);
  rect(goldShellX, y - Math.round(20 * layout.uiScaleFactor), goldShellW, Math.round(32 * layout.uiScaleFactor), 5);

  // Inner Border
  stroke(255, 215, 0); // GOLD
  strokeWeight(2);
  noFill();
  rect(goldShellX + 2, y - Math.round(18 * layout.uiScaleFactor), goldShellW - 4, Math.round(28 * layout.uiScaleFactor), 3);

  // Text
  noStroke();
  fill(255, 255, 255);
  textSize(Math.round(16 * layout.uiScaleFactor));
  textAlign(LEFT, CENTER);
  text(t('gold_hud', playerScore), goldShellX + Math.round(10 * layout.uiScaleFactor), y - Math.round(5 * layout.uiScaleFactor));
  pop();
}

function drawInventory() {
  if (!playerInventory) return;
  const potions = playerInventory['potion'] || 0;
  const speeds = playerInventory['speed'] || 0;
  if (potions === 0 && speeds === 0) return;

  const layout = getHudLayout();
  const padX = Math.round(8 * layout.uiScaleFactor);
  const padY = Math.round(8 * layout.uiScaleFactor);
  const startX = layout.HUD_MARGIN + padX;
  const startY = layout.inventoryY;
  const slotW = Math.round(48 * layout.uiScaleFactor);
  const slotH = Math.round(48 * layout.uiScaleFactor);
  const slotSpacing = Math.round(8 * layout.uiScaleFactor);
  const slots = [];

  if (potions > 0) slots.push({ label: 'P', count: potions, col: [0, 200, 80] });
  if (speeds > 0) slots.push({ label: 'S', count: speeds, col: [0, 210, 240] });

  const containerW = slots.length * (slotW + slotSpacing) + slotSpacing + Math.round(10 * layout.uiScaleFactor);
  const containerH = slotH + Math.round(20 * layout.uiScaleFactor);

  push();
  drawHudPanelShell(startX, startY, containerW - padX * 2, containerH - padY * 2, { padX: padX, padY: padY, alpha: 180 });

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

    const ctx = drawingContext;
    const cache = drawVignette._cache || {};
    if (cache.w !== vW || cache.h !== vH || !cache.gradient) {
      const centerX = vW / 2;
      const centerY = vH / 2;
      const outerRadius = Math.max(vW, vH) * 0.8;
      const innerRadius = Math.min(vW, vH) * 0.2;
      cache.w = vW;
      cache.h = vH;
      cache.gradient = ctx.createRadialGradient(
          centerX, centerY, innerRadius,
          centerX, centerY, outerRadius
      );
      cache.gradient.addColorStop(0, 'rgba(0,0,0,0)');
      cache.gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
      drawVignette._cache = cache;
    }

    ctx.fillStyle = cache.gradient;
    ctx.fillRect(0, 0, vW, vH);
    pop();
}

function getUsableCloudImages() {
  if (cachedCloudImagesSourceCount !== cloudImages.length) {
    cachedUsableCloudImages = cloudImages.filter(img => img);
    cachedCloudImagesSourceCount = cloudImages.length;
  }
  return cachedUsableCloudImages;
}

function drawDifficultyBadge() {
  const layout = getHudLayout();
  const badgeSize = Math.round(32 * layout.uiScaleFactor);
  const x = layout.difficultyX;
  const y = layout.difficultyY;

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

function drawHudWeatherClock() {
  if (typeof WeatherSystem === 'undefined') return;
  const layout = getHudLayout();
  const safeArea = layout.safeArea;
  const clockRadius = Math.round(22 * layout.uiScaleFactor);
  WeatherSystem.drawClock(layout.clockX, Math.min(safeArea.bottom - clockRadius, layout.clockY), clockRadius);
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
  const layout = getHudLayout();
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
  const padX = Math.round(10 * layout.uiScaleFactor);
  const padY = Math.round(8 * layout.uiScaleFactor);
  const startX = layout.HUD_MARGIN + padX;
  const startY = layout.sprintY;
  const containerW = layout.sprintContainerW;
  const containerH = Math.round(32 * layout.uiScaleFactor);

  const barW = containerW - Math.round(40 * layout.uiScaleFactor);
  const barH = Math.max(10, Math.round(10 * layout.uiScaleFactor));

  push();

  // Themed Background Container
  if (typeof BUTTON_BG !== 'undefined' && BUTTON_BG) tint(255, targetAlpha);
  drawHudPanelShell(startX, startY, containerW, containerH, { padX: padX, padY: padY, alpha: 200 * (targetAlpha / 255) });
  if (typeof BUTTON_BG !== 'undefined' && BUTTON_BG) noTint();

  // Bar Background (empty part)
  noStroke();
  fill(30, 30, 40, targetAlpha);
  rect(startX + Math.round(30 * layout.uiScaleFactor), startY + Math.round(11 * layout.uiScaleFactor), barW, barH, 2);

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
    rect(startX + Math.round(30 * layout.uiScaleFactor), startY + Math.round(11 * layout.uiScaleFactor), barW * pct, barH, 2);

    // Glossy highlight
    fill(255, 255, 255, 50 * (targetAlpha / 255));
    rect(startX + Math.round(30 * layout.uiScaleFactor), startY + Math.round(11 * layout.uiScaleFactor), barW * pct, barH / 2, 2);
  }

  // Cooldown Overlay (stamina flashing red)
  if (typeof sprintCooldownUntil === 'number' && now < sprintCooldownUntil) {
    if (Math.floor(now / 150) % 2 === 0) {
        fill(255, 50, 50, 120 * (targetAlpha / 255));
        rect(startX + Math.round(30 * layout.uiScaleFactor), startY + Math.round(11 * layout.uiScaleFactor), barW, barH, 2);
    }
  }

  // Icon (Energy/Lightning)
  const ix = startX + Math.round(12 * layout.uiScaleFactor);
  const iy = startY + containerH / 2 + Math.round(3 * layout.uiScaleFactor);
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
  vertex(ix, iy - Math.round(10 * layout.uiScaleFactor));
  vertex(ix + Math.round(6 * layout.uiScaleFactor), iy - Math.round(10 * layout.uiScaleFactor));
  vertex(ix - Math.round(2 * layout.uiScaleFactor), iy);
  vertex(ix + Math.round(4 * layout.uiScaleFactor), iy);
  vertex(ix - Math.round(4 * layout.uiScaleFactor), iy + Math.round(10 * layout.uiScaleFactor));
  vertex(ix, iy);
  vertex(ix - Math.round(6 * layout.uiScaleFactor), iy);
  endShape(CLOSE);

  pop();
}

function findNearestCoin(px, py) {
    if (typeof activeCoins === 'undefined' || !activeCoins || activeCoins.length === 0) return null;
    let nearest = null;
    let minDist = Infinity;
    for (const coin of activeCoins) {
        const d = Math.hypot(coin.x - px, coin.y - py);
        if (d < minDist) {
            minDist = d;
            nearest = { x: coin.x, y: coin.y };
        }
    }
    return nearest;
}

function drawCompass() {
    if (!playerPosition) return;

    const layout = getHudLayout();
    const vW = layout.vW;
    const vH = layout.vH;
    const safeArea = layout.safeArea;
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

        const margin = Math.max(40, layout.margin + 12) + (i * 5);
        const leftLimit = Math.min(safeArea.right, safeArea.left + margin);
        const rightLimit = Math.max(leftLimit, safeArea.right - margin);
        const topLimit = Math.min(safeArea.bottom, safeArea.top + margin);
        const bottomLimit = Math.max(topLimit, safeArea.bottom - Math.max(margin, Math.round(48 * layout.uiScaleFactor)));
        let tMin = Infinity;
        if (dx > 0) tMin = Math.min(tMin, (rightLimit - pScreenX) / dx);
        if (dx < 0) tMin = Math.min(tMin, (leftLimit - pScreenX) / dx);
        if (dy > 0) tMin = Math.min(tMin, (bottomLimit - pScreenY) / dy);
        if (dy < 0) tMin = Math.min(tMin, (topLimit - pScreenY) / dy);

        const edgeX = constrain(pScreenX + dx * tMin, leftLimit, rightLimit);
        const edgeY = constrain(pScreenY + dy * tMin, topLimit, bottomLimit);

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

  const validImages = getUsableCloudImages();
  if (validImages.length === 0) return;

  const cloudImg = validImages[Math.floor(Math.random() * validImages.length)];

  // Use map coordinates (world space)
  const mapW = (logicalW || 150) * cellSize;
  const mapH = (logicalH || 150) * cellSize;

  const minY = -cellSize * 5;
  const maxY = mapH + cellSize * 5;
  const yPos = minY + Math.random() * (maxY - minY);

  const baseSpeed = 0.3 + Math.random() * 1;
  const cloudRenderScale = 2.0 + Math.random() * 4.0;

  // Spawn left of map if no forceX provided
  const startX = (typeof forceX === 'number') ? forceX : -cloudImg.width * cloudRenderScale - 200;

  clouds.push({
    img: cloudImg,
    x: startX,
    y: yPos,
    baseY: yPos,
    speed: baseSpeed,
    renderScale: cloudRenderScale,
    opacity: 180 + Math.random() * 75,
    verticalDrift: (Math.random() - 0.5) * 0.15,
    driftPhase: Math.random() * Math.PI * 2
  });
  // Keep clouds sorted by size (painter's order) on insert.
  clouds.sort((a, b) => a.renderScale - b.renderScale);
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


    const cloudWidth = cloud.img.width * cloud.renderScale;
    if (cloud.x > mapW + 500) {
      clouds.splice(i, 1);
    }
  }
}

function drawClouds() {
  push();
  let tintColor = [255, 255, 255, 255];
  if (typeof WeatherSystem !== 'undefined') {
      tintColor = WeatherSystem.getCloudTint();
  }

  // Set shared state once instead of per cloud
  imageMode(CORNER);

  // Use native Canvas2D globalAlpha for massive performance gain
  // instead of p5's tint() which creates offscreen canvases.
  const ctx = drawingContext;

  // We can approximate the darkening from getCloudTint by drawing
  // the cloud, then using source-atop to overlay a dark color if needed,
  // but just letting the night overlay naturally darken them is usually
  // enough. We'll at least apply the cloud's intrinsic opacity.

  for (const cloud of clouds) {
    const w = cloud.img.width * cloud.renderScale;
    const h = cloud.img.height * cloud.renderScale;

    // Cull clouds outside the viewport (clouds live in world space)
    if (!isInView(cloud.x, cloud.y, w, h)) continue;

    const baseAlpha = cloud.opacity / 255;
    const weatherAlphaMultiplier = Math.min(tintColor[3], 255) / 255;

    ctx.globalAlpha = baseAlpha * weatherAlphaMultiplier;

    image(cloud.img, cloud.x, cloud.y, w, h);
  }

  ctx.globalAlpha = 1.0;
  pop();
}




if (typeof window !== "undefined") {
  Object.assign(window, {
    drawBottomHud,
    drawBossHud,
    drawCompass,
    drawDifficultyBadge,
    drawHealthBar,
    drawHudPerformanceOverlay,
    drawHudWeatherClock,
    drawInventory,
    drawLeftHud,
    drawManaBar,
    drawMinimap,
    drawScore,
    drawSprintMeter,
    drawVignette,
    drawXPBar,
    locatePortal,
  });
}

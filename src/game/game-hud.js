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
let lockedObjectiveEnemy = null;
let lockedObjectiveCoinKey = null;
const OBJECTIVE_LOCK_DISTANCE_TILES = 12;

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
  // The old 1.10 cap made the HUD undersized on normal desktop viewports.
  // 1.25 is roughly 14% larger while the user-facing Compact/Default/Large
  // setting still controls the final result.
  const viewportScale = Math.max(0.9, Math.min(1.25, Math.min(vW / 1280, vH / 720) || 1));
  return Math.max(0.85, Math.min(1.45, getUiScaleMultiplier(textSizeSetting) * viewportScale));
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

  const statBarW = Math.round(Math.max(1, Math.min(184 * uiScaleFactor, safeArea.width - 72 * uiScaleFactor)));
  const perfPad = Math.round(10 * uiScaleFactor);
  const perfSize = getPerformanceOverlaySize(uiScaleFactor, safeArea.width - perfPad * 2);

  // --- Top-Left Player Status Card ---
  const healthBarH = Math.round(Math.max(16, 18 * uiScaleFactor));
  const manaBarH = Math.round(Math.max(12, 14 * uiScaleFactor));
  const staminaBarH = Math.round(Math.max(12, 14 * uiScaleFactor));
  const playerPanelPad = Math.round(8 * uiScaleFactor);
  const playerPanelX = Math.round(HUD_MARGIN + playerPanelPad);
  const playerPanelY = Math.round(HUD_MARGIN + playerPanelPad);
  const statX = Math.round(playerPanelX + 28 * uiScaleFactor);
  const healthY = playerPanelY;
  const manaY = Math.round(healthY + healthBarH + 8 * uiScaleFactor);
  const staminaY = Math.round(manaY + manaBarH + 8 * uiScaleFactor);
  const goldRowY = Math.round(staminaY + staminaBarH + 8 * uiScaleFactor);
  const goldRowH = Math.round(26 * uiScaleFactor);
  const playerPanelW = Math.round((statX - playerPanelX) + statBarW + 10 * uiScaleFactor);
  const playerPanelH = Math.round((goldRowY - playerPanelY) + goldRowH);
  const scoreY = Math.round(goldRowY + goldRowH / 2);
  const inventoryY = Math.round(playerPanelY + playerPanelH + playerPanelPad + HUD_GAP + 8 * uiScaleFactor);

  // --- Right-Side Layout (Vertical Column) ---
  const rightColumnRight = Math.round(vW - HUD_MARGIN);
  const clockRadius = Math.round(22 * uiScaleFactor);
  const minimapPad = Math.min(Math.round(8 * uiScaleFactor), Math.max(0, Math.floor((safeArea.width - 1) / 2)));
  // Height of top right widget area above minimap
  const topRightWidgetHeight = Math.round(Math.max(32 * uiScaleFactor * 1.2, 22 * uiScaleFactor * 2));
  const availableRightHeight = Math.max(48, safeArea.height - topRightWidgetHeight - perfSize.height - gap * 2 - minimapPad);
  const minimapSize = Math.round(Math.min(168 * uiScaleFactor, safeArea.width * 0.24, availableRightHeight * 0.72));
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

  // Compact telemetry sits beside the silver profile/difficulty badge rather
  // than occupying the whole top-right quadrant.
  let perfRect = clampHudRect(
    minimapRect.x - perfSize.width - gap,
    Math.round(HUD_MARGIN + 4 * uiScaleFactor),
    perfSize.width,
    perfSize.height,
    safeArea,
    perfPad,
  );

  // --- Top-Center Boss Bar (Responsive Fallback) ---
  const bossPadX = Math.min(Math.round(14 * uiScaleFactor), Math.max(0, Math.floor((safeArea.width - 1) / 2)));
  const bossPadY = Math.round(18 * uiScaleFactor);
  let bossBarW = Math.round(Math.max(1, Math.min(safeArea.width - bossPadX * 2, safeArea.width * 0.38, 390 * uiScaleFactor)));
  const bossBarH = Math.round(Math.max(18, 20 * uiScaleFactor));

  // Determine clear space between top-left cluster and right column
  const leftStatsRight = Math.round(playerPanelX + playerPanelW + playerPanelPad);
  const rightColumnLeft = Math.round(vW - HUD_MARGIN - minimapSize);
  const centerSpace = Math.round(rightColumnLeft - leftStatsRight);
  const safetyMargin = Math.round(20 * uiScaleFactor);

  // Responsive fallback logic
  let bossYCoord = Math.round(54 * uiScaleFactor);
  if (bossBarW + bossPadX * 2 > centerSpace - safetyMargin) {
    const maxFittingWidth = centerSpace - safetyMargin - bossPadX * 2;
    bossBarW = Math.round(Math.max(180 * uiScaleFactor, maxFittingWidth));
  }
  // If screen is narrow or they still collide, push the boss bar below top-left stats
  if (vW < Math.round(850 * uiScaleFactor) || (bossBarW + bossPadX * 2 > centerSpace - safetyMargin)) {
    bossYCoord = Math.round(HUD_MARGIN + playerPanelH + 42 * uiScaleFactor);
  }

  const bossShell = clampHudRect(
    Math.round((vW - (bossBarW + bossPadX * 2)) / 2),
    Math.round(bossYCoord - bossPadY),
    Math.round(bossBarW + bossPadX * 2),
    Math.round(bossBarH + bossPadY * 2),
    safeArea,
  );

  // Keep telemetry beside the profile badge. Its compact width is designed to
  // fit the top-row gap, so it must not fall back into the playfield.

  // --- XP & Level Bar (Raised Bottom-Center) ---
  const xpPadX = Math.min(Math.round(18 * uiScaleFactor), Math.max(0, Math.floor((safeArea.width - 1) / 2)));
  const xpPadY = Math.round(12 * uiScaleFactor);
  const xpBarW = Math.max(1, Math.min(safeArea.width - xpPadX * 2, safeArea.width * 0.58, Math.round(440 * uiScaleFactor)));
  const xpBarH = Math.max(16, Math.round(18 * uiScaleFactor));
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
    playerPanelX,
    playerPanelY,
    playerPanelW,
    playerPanelH,
    playerPanelPad,
    statBarW,
    statX,
    healthBarH,
    manaBarH,
    staminaBarH,
    healthY: Math.round(healthY),
    manaY: Math.round(manaY),
    staminaY: Math.round(staminaY),
    goldRowY,
    goldRowH,
    scoreY: Math.round(scoreY),
    inventoryY: Math.round(inventoryY),
    sprintY: Math.round(staminaY),
    sprintContainerW: statBarW,
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

function drawPlayerStatusShell() {
  const layout = getHudLayout();
  push();
  drawHudPanelShell(
    layout.playerPanelX,
    layout.playerPanelY,
    layout.playerPanelW,
    layout.playerPanelH,
    {
      padX: layout.playerPanelPad,
      padY: layout.playerPanelPad,
      alpha: 205,
    },
  );
  pop();
}

function drawLeftHud() {
  drawPlayerStatusShell();
  drawHealthBar();
  drawManaBar();
  drawScore();
  drawInventory();
  drawSprintMeter();
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

  // Level and XP live inside the panel instead of floating above it.
  if (typeof uiFont !== 'undefined' && uiFont) textFont(uiFont);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  let sz = Math.round(10 * layout.uiScaleFactor);
  if (typeof gTextSize === 'function') gTextSize(sz); else textSize(sz);
  text(`LV ${playerLevel}  •  ${playerXP}/${xpToNextLevel} XP`, startX + barW/2, startY + barH/2 + 1);

  // Attached stat-point badge, kept inside the bottom safe area.
  if (statPoints > 0) {
      const badgeText = `+${statPoints} STAT  [I]`;
      const badgeH = Math.round(18 * layout.uiScaleFactor);
      const badgeW = Math.round(104 * layout.uiScaleFactor);
      const badgeX = startX + barW - badgeW;
      const badgeY = startY - layout.xpPadY - badgeH - Math.round(3 * layout.uiScaleFactor);
      fill(12, 12, 14, 225);
      stroke(255, 205, 40, 220);
      strokeWeight(1);
      rect(badgeX, badgeY, badgeW, badgeH, 3);
      noStroke();
      fill(255, 215, 0);
      if (typeof gTextSize === 'function') gTextSize(Math.round(9 * layout.uiScaleFactor));
      else textSize(Math.round(9 * layout.uiScaleFactor));
      text(badgeText, badgeX + badgeW/2, badgeY + badgeH/2 + 1);
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
  let sz = Math.round(11 * layout.uiScaleFactor);
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
  let sz = Math.round(9 * layout.uiScaleFactor);
  if (typeof gTextSize === 'function') gTextSize(sz); else textSize(sz);
  text(`${Math.floor(playerMana)}/${maxMana}`, startX + barW / 2, startY + barH / 2 + 1);

  pop();
}

function drawBossHealthBar() {
  // Do not present the training dummy as a boss before combat is introduced.
  if (isTutorialMap && tutorialStep < TUTORIAL_STEP_COMBAT) return;
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
  text(
    isTutorialMap ? 'TRAINING DUMMY' : t('boss_name'),
    x + barW/2,
    y - Math.round(6 * layout.uiScaleFactor),
  );

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

  // Numeric HP makes every hit legible and exposes accidental burst damage.
  const hpLabel = `${Math.max(0, Math.ceil(boss.health))} / ${Math.max(1, Math.ceil(boss.maxHealth))}`;
  if (uiFont) textFont(uiFont);
  textAlign(CENTER, CENTER);
  gTextSize(Math.round(10 * layout.uiScaleFactor));
  noStroke();
  fill(0, 0, 0, 190);
  text(hpLabel, x + barW/2 + 1, y + barH/2 + 2);
  fill(255);
  text(hpLabel, x + barW/2, y + barH/2 + 1);

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
  const rowX = layout.playerPanelX;
  const rowY = layout.goldRowY;
  const rowW = layout.playerPanelW;
  const rowH = layout.goldRowH;

  push();

  // UI Pulse Effect
  const now = millis();
  let pulseScale = 1.0;
  if (now - lastScoreChange < 200) {
      pulseScale = map(now - lastScoreChange, 0, 200, 1.2, 1.0);
  }

  const centerX = rowX + rowW / 2;
  const centerY = rowY + rowH / 2;

  translate(centerX, centerY);
  scale(pulseScale);
  translate(-centerX, -centerY);

  if (uiFont) textFont(uiFont);

  fill(8, 8, 10, 150);
  stroke(255, 215, 0, 150);
  strokeWeight(1);
  rect(rowX, rowY, rowW, rowH, 3);

  noStroke();
  fill(255, 220, 80);
  textSize(Math.round(13 * layout.uiScaleFactor));
  textAlign(LEFT, CENTER);
  text(t('gold_hud', playerScore), rowX + Math.round(10 * layout.uiScaleFactor), centerY + 1);
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

  if (potions > 0) slots.push({ key: '1', name: 'HP', count: potions, sprite: healthPotionSprite, col: [255, 70, 70] });
  if (speeds > 0) slots.push({ key: '2', name: 'SPD', count: speeds, sprite: powerupPotionSprite, col: [0, 210, 240] });

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

    // Distinct potion artwork, matching the bottle that drops in the world.
    if (s.sprite) {
      const iconSize = Math.round(28 * layout.uiScaleFactor);
      image(s.sprite, sx + (slotW - iconSize) / 2, sy + Math.round(8 * layout.uiScaleFactor), iconSize, iconSize);
    } else {
      fill(s.col[0], s.col[1], s.col[2]);
      noStroke();
      ellipse(sx + slotW / 2, sy + slotH / 2 - 4, 20, 20);
    }

    // Count
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    if (typeof gTextSize === 'function') gTextSize(14); else textSize(14);
    text('x' + s.count, sx + slotW / 2, sy + slotH - 8);

    // Key hint
    fill(200, 200, 200, 180);
    if (typeof gTextSize === 'function') gTextSize(10); else textSize(10);
    text('[' + s.key + '] ' + s.name, sx + slotW / 2, sy + 6);
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
  const maxDur = typeof playerMaxStamina !== 'undefined' ? playerMaxStamina * 30 : 3000;
  const actualPct = (typeof sprintRemainingMs === 'number' && maxDur > 0) ? (sprintRemainingMs / maxDur) : 0;
  lerpedSprintPct = lerp(lerpedSprintPct, actualPct, 0.14);
  const pct = constrain(lerpedSprintPct, 0, 1);
  const exhausted = typeof sprintCooldownUntil === 'number' && now < sprintCooldownUntil;
  const startX = layout.statX;
  const startY = layout.staminaY;
  const barW = layout.statBarW;
  const barH = layout.staminaBarH;

  push();
  noStroke();
  fill(33, 28, 18, 235);
  rect(startX, startY, barW, barH, 2);
  if (pct > 0.005) {
    if (exhausted) fill(152, 46, 32);
    else if (actualPct < 0.35) fill(205, 132, 36);
    else fill(52, 132, 66);
    rect(startX, startY, barW * pct, barH, 2);
    fill(255, 239, 185, 42);
    rect(startX, startY, barW * pct, barH / 2, 2);
  }

  stroke(184, 134, 11, 210);
  strokeWeight(Math.max(1, layout.uiScaleFactor));
  noFill();
  rect(startX, startY, barW, barH, 2);

  // Small pixel boot icon, aligned with the health and mana icons.
  const ix = startX - Math.round(15 * layout.uiScaleFactor);
  const iy = startY + barH / 2;
  noStroke();
  fill(exhausted ? 190 : 222, exhausted ? 70 : 176, exhausted ? 48 : 72);
  beginShape();
  vertex(ix - 5, iy - 7); vertex(ix + 1, iy - 7);
  vertex(ix + 1, iy + 1); vertex(ix + 7, iy + 4);
  vertex(ix + 7, iy + 7); vertex(ix - 6, iy + 7);
  vertex(ix - 6, iy + 2);
  endShape(CLOSE);

  if (typeof uiFont !== 'undefined' && uiFont) textFont(uiFont);
  fill(255, 244, 211);
  textAlign(CENTER, CENTER);
  noStroke();
  if (typeof gTextSize === 'function') gTextSize(Math.round(8 * layout.uiScaleFactor));
  text(exhausted ? 'STAMINA — REST' : 'STAMINA', startX + barW / 2, startY + barH / 2 + 1);

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

function findNearestLivingEnemy(px, py) {
    if (typeof enemies === 'undefined' || !enemies || enemies.length === 0) return null;
    let nearest = null;
    let minDist = Infinity;
    for (const enemy of enemies) {
        if (!enemy || (typeof enemy.health === 'number' && enemy.health <= 0)) continue;
        const enemyX = Number(enemy.x);
        const enemyY = Number(enemy.y);
        if (!Number.isFinite(enemyX) || !Number.isFinite(enemyY)) continue;
        const d = Math.hypot(enemyX - px, enemyY - py);
        if (d < minDist) {
            minDist = d;
            nearest = { x: enemyX, y: enemyY };
        }
    }
    return nearest;
}

function getTrackedLivingEnemy(px, py) {
    const lockedIsAlive = lockedObjectiveEnemy &&
        enemies.includes(lockedObjectiveEnemy) &&
        (typeof lockedObjectiveEnemy.health !== 'number' || lockedObjectiveEnemy.health > 0);
    if (!lockedIsAlive) lockedObjectiveEnemy = null;

    if (!lockedObjectiveEnemy) {
        let nearest = null;
        let minDist = Infinity;
        for (const enemy of enemies || []) {
            if (!enemy || (typeof enemy.health === 'number' && enemy.health <= 0)) continue;
            const d = Math.hypot(Number(enemy.x) - px, Number(enemy.y) - py);
            if (Number.isFinite(d) && d < minDist) {
                minDist = d;
                nearest = enemy;
            }
        }
        if (nearest && minDist <= OBJECTIVE_LOCK_DISTANCE_TILES) lockedObjectiveEnemy = nearest;
        return nearest ? { x: Number(nearest.x), y: Number(nearest.y) } : null;
    }
    return { x: Number(lockedObjectiveEnemy.x), y: Number(lockedObjectiveEnemy.y) };
}

function getTrackedCoin(px, py) {
    const coinList = Array.isArray(activeCoins) ? activeCoins : [];
    if (lockedObjectiveCoinKey) {
        const lockedCoin = coinList.find(coin => `${coin.x},${coin.y}` === lockedObjectiveCoinKey);
        if (lockedCoin) return { x: lockedCoin.x, y: lockedCoin.y };
        lockedObjectiveCoinKey = null;
    }

    const nearest = findNearestCoin(px, py);
    if (nearest && Math.hypot(nearest.x - px, nearest.y - py) <= OBJECTIVE_LOCK_DISTANCE_TILES) {
        lockedObjectiveCoinKey = `${nearest.x},${nearest.y}`;
    }
    return nearest;
}

function getCompassTopLimit(layout, playerScreenY, markerMargin) {
    const uiPad = Math.round(18 * layout.uiScaleFactor);
    const playerBottom = layout.playerPanelY + layout.playerPanelH + layout.playerPanelPad;
    const bossBottom = layout.bossY + layout.bossBarH + layout.bossPadY;
    const performanceBottom = performanceOverlayEnabled
        ? layout.perfY + layout.perfSize.height
        : layout.safeArea.top;
    const desiredTop = Math.max(
        layout.safeArea.top + markerMargin,
        playerBottom + uiPad,
        bossBottom + uiPad,
        performanceBottom + uiPad,
    );
    // Keep a usable upward lane on unusually short viewports.
    return Math.min(desiredTop, Math.max(layout.safeArea.top + markerMargin, playerScreenY - markerMargin));
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

    // Track the closest remaining objective of each kind independently.
    const nearestEnemy = getTrackedLivingEnemy(pX, pY);
    if (nearestEnemy) activeMarkers.push({ x: nearestEnemy.x, y: nearestEnemy.y, type: 'enemy', label: 'MOB', lane: -1 });

    const nearestCoin = getTrackedCoin(pX, pY);
    if (nearestCoin) activeMarkers.push({ x: nearestCoin.x, y: nearestCoin.y, type: 'coin', label: 'COIN', lane: 1 });

    // Portal
    if (isPortalActive && portalPos) {
        activeMarkers.push({ x: portalPos.x, y: portalPos.y, type: 'portal', label: 'PORTAL' });
    }

    activeMarkers.forEach((m, i) => {
        const tScreenX = (m.x * cellSize + cellSize / 2) - camX;
        const tScreenY = (m.y * cellSize + cellSize / 2) - camY;
        const dx = tScreenX - pScreenX;
        const dy = tScreenY - pScreenY;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
        const distTiles = Math.hypot(dx, dy) / cellSize;
        const angle = atan2(dy, dx);

        const margin = Math.max(40, layout.margin + 12) + (i * 5);
        const leftLimit = Math.min(safeArea.right, safeArea.left + margin);
        const rightLimit = Math.max(leftLimit, safeArea.right - margin);
        const topLimit = Math.min(safeArea.bottom, getCompassTopLimit(layout, pScreenY, margin));
        const bottomLimit = Math.max(topLimit, safeArea.bottom - Math.max(margin, Math.round(48 * layout.uiScaleFactor)));
        const targetIsNearbyAndVisible = distTiles <= OBJECTIVE_LOCK_DISTANCE_TILES &&
            tScreenX >= leftLimit && tScreenX <= rightLimit &&
            tScreenY >= topLimit && tScreenY <= bottomLimit;

        let markerX;
        let markerY;
        let markerAngle = angle;
        if (targetIsNearbyAndVisible) {
            // Once close, pin the tracker to the actual target until it is resolved.
            markerX = constrain(tScreenX, leftLimit, rightLimit);
            markerY = constrain(tScreenY - cellSize * 0.7, topLimit, bottomLimit);
        } else {
            let tMin = Infinity;
            if (dx > 0) tMin = Math.min(tMin, (rightLimit - pScreenX) / dx);
            if (dx < 0) tMin = Math.min(tMin, (leftLimit - pScreenX) / dx);
            if (dy > 0) tMin = Math.min(tMin, (bottomLimit - pScreenY) / dy);
            if (dy < 0) tMin = Math.min(tMin, (topLimit - pScreenY) / dy);

            const laneOffset = (m.lane || 0) * Math.round(14 * layout.uiScaleFactor);
            const perpendicularX = -Math.sin(angle) * laneOffset;
            const perpendicularY = Math.cos(angle) * laneOffset;
            markerX = constrain(pScreenX + dx * tMin + perpendicularX, leftLimit, rightLimit);
            markerY = constrain(pScreenY + dy * tMin + perpendicularY, topLimit, bottomLimit);
        }

        let markerColor;
        if (m.type === 'enemy') markerColor = color(255, 50, 50);
        else if (m.type === 'coin') markerColor = color(255, 215, 0);
        else if (m.type === 'portal') markerColor = color(180, 50, 255);

        const alpha = map(sin(millis() / 200), -1, 1, 180, 255);

        push();
        translate(markerX, markerY);
        rotate(markerAngle);

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

        rotate(-markerAngle);
        noStroke();
        if (uiFont) textFont(uiFont);

        // Label (yellow COIN, red MOB, or purple PORTAL)
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

// game-tutorial.js — Tutorial system and legacy tutorial
// Extracted from 4-Game.js

function loadTutorialMap() {
  verboseLog('[game] Loading Tutorial Map...');
  try {
    logicalW = 20;
    logicalH = 20;
    mapStates = new Uint8Array(logicalW * logicalH);
    terrainLayer = new Uint8Array(logicalW * logicalH);

    const W = logicalW, H = logicalH;
    const _s = (x, y, t) => { mapStates[y * W + x] = t; };

    // 1. Fill with Grass, fence the border
    for (let i = 0; i < mapStates.length; i++) {
      const x = i % W, y = Math.floor(i / W);
      mapStates[i] = (x === 0 || x === W-1 || y === 0 || y === H-1)
        ? TILE_TYPES.FOREST : TILE_TYPES.GRASS;
    }

    // 2. Internal Zone Walls
    // Vertical wall x=10 from y=10 down to border (separates bottom halves)
    for (let y = 10; y < H; y++) _s(10, y, TILE_TYPES.FOREST);
    // Horizontal wall y=10 across full width (separates top from bottom)
    for (let x = 0; x < W; x++) _s(x, 10, TILE_TYPES.FOREST);
    // Gaps: north passage at x=5 and x=15
    _s(5, 10, TILE_TYPES.GRASS);
    _s(15, 10, TILE_TYPES.GRASS);

    // 3. Snapshot terrain BEFORE placing items/coins
    terrainLayer = mapStates.slice();

    // 4. Spawns
    playerPosition = { x: 3, y: 15 };
    initialSpawnPosition = { x: 3, y: 15 };

    // Training Dummy (Passive Beetle)
    const dummy = createBeetle(5, 5);
    dummy.aggro = false;
    dummy.health = 5;
    enemies.push(dummy);

    // Coins (placed AFTER terrainLayer snapshot so terrain underneath is GRASS)
    _s(15, 5, TILE_TYPES.COIN);
    _s(16, 4, TILE_TYPES.COIN);
    _s(14, 6, TILE_TYPES.COIN);

    // Portal (Top Right)
    portalPos = { x: 17, y: 3 };
    isPortalActive = false;

    // 5. Reset tutorial state
    tutorialStep = 0;
    tutorialMoved = false; tutorialAttacked = false; tutorialCollected = false;
    tutorialSprintDetected = false; tutorialHitLanded = false;
    tutorialStepTimer = 0; tutorialCoinSnapshot = 3;
    tutorialMessage = ''; tutorialMessageTimer = 0; tutorialArrowBlink = 0;

    renderX = playerPosition.x; renderY = playerPosition.y;
    renderStartX = renderX; renderStartY = renderY; renderTargetX = renderX; renderTargetY = renderY;

    smoothCamX = playerPosition.x * cellSize - (width || 640) / 2;
    smoothCamY = playerPosition.y * cellSize - (height || 480) / 2;

    createMapImage();
    verboseLog('[game] Tutorial Map Ready.');
  } catch (e) {
    console.warn('[game] loadTutorialMap error:', e);
  } finally {
    showLoadingOverlay = false;
    mapLoadComplete = true;
    completeLoadingProgress();
  }
}

function _countCoins() {
  if (!mapStates) return 0;
  let c = 0;
  for (let i = 0; i < mapStates.length; i++) {
    if (mapStates[i] === TILE_TYPES.COIN) c++;
  }
  return c;
}

function _sprintKeyLabel() { return 'SHIFT'; }

function _attackKeyLabel() { return 'LEFT CLICK or E'; }

function _advanceTutorial(nextStep, msg) {
  tutorialStep = nextStep;
  tutorialStepTimer = 0;
  tutorialArrowBlink = 0;
  if (msg) _setTutorialMsg(msg, 2500);
  if (nextStep === 3) tutorialCoinSnapshot = _countCoins();
  verboseLog('[tutorial] Advanced to step', nextStep);
}

function _setTutorialMsg(msg, durationMs) {
  if (tutorialMessageTimer > 500 && tutorialMessage !== msg) return;
  tutorialMessage = msg;
  tutorialMessageTimer = durationMs || 2500;
}

function showTutorial(id) {
  const tutorials = {
    'welcome': {
      title: t('tut_title'),
      lines: [
        t('tut_move'),
        t('tut_sprint'),
        t('tut_jump'),
        t('tut_attack'),
        t('tut_items'),
        '',
        t('tut_objective'),
        t('tut_objective_text'),
      ]
    }
  };
  activeTutorial = tutorials[id] || null;
}

function handleTutorialLogic() {
  if (!isTutorialMap) return;
  if (!playerPosition) return;

  const pX = playerPosition.x;
  const pY = playerPosition.y;
  const dt = gameDelta || 16.67;
  tutorialStepTimer += dt;
  tutorialArrowBlink += dt;

  if (tutorialMessageTimer > 0) {
    tutorialMessageTimer -= dt;
    if (tutorialMessageTimer <= 0) { tutorialMessage = ''; tutorialMessageTimer = 0; }
  }

  // Step 0: MOVEMENT — head north through gap at (5,10)
  if (tutorialStep === 0) {
    if (pX !== 3 || pY !== 15) tutorialMoved = true;
    if (pY < 10) _advanceTutorial(1, t('tut_made_it'));
  }
  // Step 1: SPRINT — brief sprint lesson in top zone
  else if (tutorialStep === 1) {
    if (sprintActive) tutorialSprintDetected = true;
    if (tutorialSprintDetected || tutorialStepTimer > 6000) {
      _advanceTutorial(2, tutorialSprintDetected ? t('tut_fast2') : '');
    }
    if (pY >= 10) _setTutorialMsg(t('tut_come_back_sprint', _sprintKeyLabel()), 2500);
  }
  // Step 2: COMBAT — defeat the beetle at (5,5)
  else if (tutorialStep === 2) {
    if (isAttacking && !tutorialHitLanded) tutorialAttacked = true;
    if (enemies.length > 0 && enemies[0].health < (enemies[0].maxHealth || 999)) tutorialHitLanded = true;
    if (enemies.length === 0) _advanceTutorial(3, t('tut_pest_eliminated'));
    if (enemies.length > 0 && pX > 12 && pY < 10) _setTutorialMsg(t('tut_defeat_first'), 2500);
    if (pY >= 10) _setTutorialMsg(t('tut_pest_north'), 2500);
  }
  // Step 3: COLLECT COINS
  else if (tutorialStep === 3) {
    const coinCount = _countCoins();
    if (tutorialCoinSnapshot > 0 && coinCount < tutorialCoinSnapshot) {
      tutorialCoinSnapshot = coinCount;
      if (coinCount > 0) _setTutorialMsg(t('tut_coins_left', coinCount), 2000);
    }
    if (!hasAnyCoins()) {
      isPortalActive = true;
      localStorage.setItem('tutorialComplete', 'true');
      _advanceTutorial(4, t('tut_coins_collected'));
    }
    if (pX < 5 && pY < 10) _setTutorialMsg(t('tut_coins_east'), 2500);
    if (pY >= 10) _setTutorialMsg(t('tut_collect_north'), 2500);
  }
  // Step 4: ENTER PORTAL
  else if (tutorialStep === 4) {
    if (pY >= 10) _setTutorialMsg(t('tut_portal_north'), 2500);
    else if (pX < 8 && pY < 10) _setTutorialMsg(t('tut_portal_east'), 2500);
  }
}

function drawTutorial() {
  if (activeTutorial) { drawLegacyTutorial(); return; }
  if (!isTutorialMap) return;
  if (!playerPosition) return;

  push();
  const camX = Math.floor(smoothCamX || 0);
  const camY = Math.floor(smoothCamY || 0);
  const pX = playerPosition.x;
  const pY = playerPosition.y;
  const t = millis();

  textAlign(CENTER, CENTER);
  if (uiFont) textFont(uiFont);

  const drawTooltip = (txt, tx, ty, opts) => {
    const col = (opts && opts.color) || [255, 215, 0];
    const sz = (opts && opts.size) || 20;
    gTextSize(sz);
    const px = tx * cellSize + cellSize / 2 - camX;
    const py = ty * cellSize - 40 - camY + Math.sin(t * 0.004) * 5;
    const tw = textWidth(txt) + 24;
    const th = sz + 14;
    fill(0, 0, 0, 180); noStroke();
    rect(px - tw/2, py - th/2, tw, th, 6);
    stroke(col[0], col[1], col[2], 120); strokeWeight(1);
    rect(px - tw/2, py - th/2, tw, th, 6);
    noStroke();
    fill(col[0], col[1], col[2]);
    text(txt, px, py);
  };

  const drawPlayerTooltip = (txt, opts) => {
    const rX = isMoving ? renderX : pX;
    const rY = isMoving ? renderY : pY;
    drawTooltip(txt, rX, rY - 0.5, opts);
  };

  const drawArrow = (tx, ty, label) => {
    const px = tx * cellSize + cellSize / 2 - camX;
    const py = ty * cellSize - camY;
    const bounce = Math.sin(t * 0.006) * 8;
    const alpha = 180 + Math.sin(t * 0.008) * 75;
    push();
    translate(px, py - 55 + bounce);
    fill(255, 215, 0, alpha); noStroke();
    triangle(0, 18, -10, 0, 10, 0);
    if (label) {
      gTextSize(14);
      const lw = textWidth(label) + 12;
      fill(0, 0, 0, 160); noStroke();
      rect(-lw/2, -26, lw, 20, 4);
      fill(255, 215, 0, alpha);
      text(label, 0, -16);
    }
    pop();
  };

  // Step list panel (left margin)
  const stepNames = [t('tut_step_move'), t('tut_step_sprint'), t('tut_step_fight'), t('tut_step_collect'), t('tut_step_portal')];
  const listX = 15, listY = 80, rowH = 22, panelW = 110;
  const panelH = stepNames.length * rowH + 16;
  fill(0, 0, 0, 150); noStroke();
  rect(listX, listY, panelW, panelH, 6);
  stroke(255, 215, 0, 60); strokeWeight(1);
  rect(listX, listY, panelW, panelH, 6);
  noStroke();
  for (let i = 0; i < stepNames.length; i++) {
    const sy = listY + 12 + i * rowH;
    let icon, col;
    if (i < tutorialStep)      { icon = '\u2713'; col = [100, 220, 100]; }
    else if (i === tutorialStep) { icon = '\u25B6'; col = [255, 215, 0]; }
    else                         { icon = '\u00B7'; col = [140, 140, 140]; }
    gTextSize(13); textAlign(LEFT, CENTER);
    fill(col[0], col[1], col[2]);
    text(icon + '  ' + stepNames[i], listX + 10, sy);
  }
  textAlign(CENTER, CENTER);

  const warningActive = tutorialMessage && tutorialMessageTimer > 0;

  if (tutorialStep === 0 && !warningActive) {
    if (!tutorialMoved) drawPlayerTooltip(t('tut_wasd'));
    else { drawPlayerTooltip(t('tut_head_north'), { size: 18 }); drawArrow(5, 10, t('tut_gap')); }
  }
  else if (tutorialStep === 1 && !warningActive) {
    if (!tutorialSprintDetected) drawPlayerTooltip(t('tut_sprint_prompt', _sprintKeyLabel()));
    else drawPlayerTooltip(t('tut_fast'), { color: [100, 255, 100] });
  }
  else if (tutorialStep === 2 && !warningActive) {
    if (enemies.length > 0) {
      const beetle = enemies[0];
      drawArrow(beetle.x, beetle.y, t('tut_target'));
      if (!tutorialHitLanded) {
        drawPlayerTooltip(t('tut_attack_prompt', _attackKeyLabel()));
        drawTooltip(t('tut_approach'), beetle.x, beetle.y + 2, { size: 16, color: [255, 100, 100] });
      } else {
        drawPlayerTooltip(t('tut_keep_attacking'), { color: [255, 150, 50] });
      }
    }
  }
  else if (tutorialStep === 3 && !warningActive) {
    const coinCount = _countCoins();
    if (coinCount > 0) {
      drawPlayerTooltip(t('tut_collect_coins', coinCount), { size: 18 });
      if (mapStates) {
        let shown = 0;
        for (let i = 0; i < mapStates.length && shown < 3; i++) {
          if (mapStates[i] === TILE_TYPES.COIN) {
            drawArrow(i % logicalW, Math.floor(i / logicalW), null);
            shown++;
          }
        }
      }
    }
  }
  else if (tutorialStep === 4 && !warningActive) {
    if (portalPos) {
      drawArrow(portalPos.x, portalPos.y, t('tut_portal'));
      drawPlayerTooltip(t('tut_enter_portal'), { color: [100, 200, 255] });
    }
  }

  // Floating celebration / warning message
  if (tutorialMessage && tutorialMessageTimer > 0) {
    const msgAlpha = Math.min(255, tutorialMessageTimer * 0.5);
    gTextSize(26);
    const mw = textWidth(tutorialMessage) + 30;
    const mx = (virtualW || (width / gameScale)) / 2;
    const my = (virtualH || (height / gameScale)) * 0.35 + Math.sin(t * 0.003) * 3;
    fill(0, 0, 0, msgAlpha * 0.7); noStroke();
    rect(mx - mw/2, my - 20, mw, 42, 8);
    stroke(255, 215, 0, msgAlpha * 0.5); strokeWeight(1);
    rect(mx - mw/2, my - 20, mw, 42, 8);
    noStroke();
    fill(255, 255, 255, msgAlpha);
    text(tutorialMessage, mx, my);
  }

  pop();
}

function drawLegacyTutorial() {
  if (!activeTutorial) return;
  const vW = virtualW || (width / gameScale);
  const vH = virtualH || (height / gameScale);
  const panelW = 450, panelH = 340;
  const x = (vW - panelW) / 2;
  const y = (vH - panelH) / 2;

  push();
  fill(0, 150); noStroke();
  rect(0, 0, vW, vH);
  fill(20, 20, 25, 240);
  stroke(0); strokeWeight(4);
  rect(x - 10, y - 10, panelW + 20, panelH + 20, 8);
  stroke(184, 134, 11); strokeWeight(2); noFill();
  rect(x - 5, y - 5, panelW + 10, panelH + 10, 4);
  if (uiFont) textFont(uiFont);
  fill(255, 215, 0); noStroke(); textAlign(CENTER, TOP);
  gTextSize(28);
  text(activeTutorial.title, x + panelW/2, y + 25);
  fill(255); textAlign(LEFT, TOP); gTextSize(18);
  let lineY = y + 80;
  for (const line of activeTutorial.lines) {
    text(line, x + 40, lineY);
    lineY += 28;
  }
  textAlign(CENTER, BOTTOM);
  fill(255, 255, 255, 180); gTextSize(14);
  text('Press any key or click to continue', x + panelW/2, y + panelH - 25);
  pop();
}


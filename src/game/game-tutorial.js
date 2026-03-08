// game-tutorial.js — Tutorial system and legacy tutorial
// Extracted from 4-Game.js

// --- Tutorial Map Constants ---
const TUTORIAL_MAP_W = 20; // tutorial map width in tiles
const TUTORIAL_MAP_H = 20; // tutorial map height in tiles
const TUTORIAL_WALL_Y = 10; // y of the horizontal wall dividing the map
const TUTORIAL_WALL_X = 10; // x of the vertical wall in the bottom half
const TUTORIAL_GAP1_X = 5; // gap in the horizontal wall (left passage)
const TUTORIAL_GAP2_X = 15; // gap in the horizontal wall (right passage)
const TUTORIAL_PLAYER_SPAWN_X = 3; // player start tile x
const TUTORIAL_PLAYER_SPAWN_Y = 15; // player start tile y
const TUTORIAL_DUMMY_X = 5; // training dummy beetle x
const TUTORIAL_DUMMY_Y = 5; // training dummy beetle y
const TUTORIAL_DUMMY_HP = 5; // training dummy starting HP
const TUTORIAL_COIN_POSITIONS = [
  { x: 15, y: 5 },
  { x: 16, y: 4 },
  { x: 14, y: 6 },
]; // collectible coin tiles
const TUTORIAL_PORTAL_X = 17; // exit portal tile x
const TUTORIAL_PORTAL_Y = 3; // exit portal tile y
const TUTORIAL_INITIAL_COINS = 3; // number of coins placed at start
const TUTORIAL_SPRINT_TIMEOUT_MS = 6000; // ms to wait for sprint before auto-advancing
const TUTORIAL_MSG_DEFAULT_MS = 2500; // default duration for tutorial floating messages
const TUTORIAL_MSG_HOLD_MS = 500; // guard threshold: don't replace a message younger than this

// Tutorial step indices (used as values for tutorialStep)
const TUTORIAL_STEP_MOVE = 0; // teach movement, guide player through north gap
const TUTORIAL_STEP_SPRINT = 1; // teach sprinting
const TUTORIAL_STEP_COMBAT = 2; // teach attacking the training dummy
const TUTORIAL_STEP_COINS = 3; // teach collecting coins
const TUTORIAL_STEP_PORTAL = 4; // guide player to the exit portal

// Builds a small 20×20 tutorial map and initialises all tutorial state.
function loadTutorialMap() {
  verboseLog("[game] Loading Tutorial Map...");
  try {
    logicalW = TUTORIAL_MAP_W;
    logicalH = TUTORIAL_MAP_H;
    mapStates = new Uint8Array(logicalW * logicalH);
    terrainLayer = new Uint8Array(logicalW * logicalH);

    const W = logicalW,
      H = logicalH;
    // Local helper to set a single tile
    const setTile = (x, y, tileType) => {
      mapStates[y * W + x] = tileType;
    };

    // --- Border & Fill ---
    for (let i = 0; i < mapStates.length; i++) {
      const x = i % W,
        y = Math.floor(i / W);
      mapStates[i] =
        x === 0 || x === W - 1 || y === 0 || y === H - 1
          ? TILE_TYPES.FOREST
          : TILE_TYPES.GRASS;
    }

    // --- Internal Zone Walls ---
    // Vertical wall separates the bottom-left and bottom-right zones
    for (let y = TUTORIAL_WALL_Y; y < H; y++)
      setTile(TUTORIAL_WALL_X, y, TILE_TYPES.FOREST);
    // Horizontal wall separates the top half (combat/coin zones) from the bottom half
    for (let x = 0; x < W; x++) setTile(x, TUTORIAL_WALL_Y, TILE_TYPES.FOREST);
    // Gaps allow passage north
    setTile(TUTORIAL_GAP1_X, TUTORIAL_WALL_Y, TILE_TYPES.GRASS);
    setTile(TUTORIAL_GAP2_X, TUTORIAL_WALL_Y, TILE_TYPES.GRASS);

    // --- Snapshot terrain before items/coins ---
    terrainLayer = mapStates.slice();

    // --- Spawns ---
    playerPosition = { x: TUTORIAL_PLAYER_SPAWN_X, y: TUTORIAL_PLAYER_SPAWN_Y };
    initialSpawnPosition = {
      x: TUTORIAL_PLAYER_SPAWN_X,
      y: TUTORIAL_PLAYER_SPAWN_Y,
    };

    // Training dummy (passive beetle)
    const dummy = createBeetle(TUTORIAL_DUMMY_X, TUTORIAL_DUMMY_Y);
    dummy.aggro = false;
    dummy.health = TUTORIAL_DUMMY_HP;
    enemies.push(dummy);

    // Coins (placed after terrainLayer snapshot so underlying terrain is GRASS)
    if (typeof activeCoins !== "undefined") activeCoins = [];
    for (const coin of TUTORIAL_COIN_POSITIONS) {
      setTile(coin.x, coin.y, TILE_TYPES.COIN);
      if (typeof activeCoins !== "undefined" && activeCoins) {
        activeCoins.push({ x: coin.x, y: coin.y });
      }
    }

    // Exit portal
    portalPos = { x: TUTORIAL_PORTAL_X, y: TUTORIAL_PORTAL_Y };
    isPortalActive = false;

    // --- Reset Tutorial State ---
    tutorialStep = TUTORIAL_STEP_MOVE;
    tutorialMoved = false;
    tutorialAttacked = false;
    tutorialCollected = false;
    tutorialSprintDetected = false;
    tutorialHitLanded = false;
    tutorialStepTimer = 0;
    tutorialCoinSnapshot = TUTORIAL_INITIAL_COINS;
    tutorialMessage = "";
    tutorialMessageTimer = 0;
    tutorialArrowBlink = 0;

    renderX = playerPosition.x;
    renderY = playerPosition.y;
    renderStartX = renderX;
    renderStartY = renderY;
    renderTargetX = renderX;
    renderTargetY = renderY;

    smoothCamX = playerPosition.x * cellSize - (width || 640) / 2;
    smoothCamY = playerPosition.y * cellSize - (height || 480) / 2;

    createMapImage();
    verboseLog("[game] Tutorial Map Ready.");
  } catch (e) {
    console.warn("[game] loadTutorialMap error:", e);
  } finally {
    showLoadingOverlay = false;
    mapLoadComplete = true;
    completeLoadingProgress();
  }
}

// Returns the number of COIN tiles currently on the map.
function _countCoins() {
  if (!mapStates) return 0;
  let count = 0;
  for (let i = 0; i < mapStates.length; i++) {
    if (mapStates[i] === TILE_TYPES.COIN) count++;
  }
  return count;
}

// Returns the display label for the sprint key.
function _sprintKeyLabel() {
  return "SHIFT";
}

// Returns the display label for the attack key.
function _attackKeyLabel() {
  return "LEFT CLICK or E";
}

// Advances the tutorial to the next step and optionally flashes a message.
function _advanceTutorial(nextStep, msg) {
  tutorialStep = nextStep;
  tutorialStepTimer = 0;
  tutorialArrowBlink = 0;
  if (msg) _setTutorialMsg(msg, TUTORIAL_MSG_DEFAULT_MS);
  if (nextStep === TUTORIAL_STEP_COINS) tutorialCoinSnapshot = _countCoins();
  verboseLog("[tutorial] Advanced to step", nextStep);
}

// Sets a floating tutorial message; ignores the update if the current message is fresh.
function _setTutorialMsg(msg, durationMs) {
  if (tutorialMessageTimer > TUTORIAL_MSG_HOLD_MS && tutorialMessage !== msg)
    return;
  tutorialMessage = msg;
  tutorialMessageTimer = durationMs || TUTORIAL_MSG_DEFAULT_MS;
}

// Shows a full-screen legacy-style tutorial overlay by ID (e.g. 'welcome').
function showTutorial(id) {
  const tutorials = {
    welcome: {
      title: t("tut_title"),
      lines: [
        t("tut_move"),
        t("tut_sprint"),
        t("tut_jump"),
        t("tut_attack"),
        t("tut_items"),
        "",
        t("tut_objective"),
        t("tut_objective_text"),
      ],
    },
  };
  activeTutorial = tutorials[id] || null;
}

// Drives tutorial step transitions each frame based on player position and actions.
function handleTutorialLogic() {
  if (!isTutorialMap) return;
  if (!playerPosition) return;

  const pX = playerPosition.x;
  const pY = playerPosition.y;
  const dt = gameDelta;
  tutorialStepTimer += dt;
  tutorialArrowBlink += dt;

  if (tutorialMessageTimer > 0) {
    tutorialMessageTimer -= dt;
    if (tutorialMessageTimer <= 0) {
      tutorialMessage = "";
      tutorialMessageTimer = 0;
    }
  }

  // Step 0: MOVEMENT — head north through gap at (TUTORIAL_GAP1_X, TUTORIAL_WALL_Y)
  if (tutorialStep === TUTORIAL_STEP_MOVE) {
    if (pX !== TUTORIAL_PLAYER_SPAWN_X || pY !== TUTORIAL_PLAYER_SPAWN_Y)
      tutorialMoved = true;
    if (pY < TUTORIAL_WALL_Y)
      _advanceTutorial(TUTORIAL_STEP_SPRINT, t("tut_made_it"));
  }
  // Step 1: SPRINT — brief sprint lesson in top zone
  else if (tutorialStep === TUTORIAL_STEP_SPRINT) {
    if (sprintActive) tutorialSprintDetected = true;
    if (
      tutorialSprintDetected ||
      tutorialStepTimer > TUTORIAL_SPRINT_TIMEOUT_MS
    ) {
      _advanceTutorial(
        TUTORIAL_STEP_COMBAT,
        tutorialSprintDetected ? t("tut_fast2") : "",
      );
    }
    if (pY >= TUTORIAL_WALL_Y)
      _setTutorialMsg(
        t("tut_come_back_sprint", _sprintKeyLabel()),
        TUTORIAL_MSG_DEFAULT_MS,
      );
  }
  // Step 2: COMBAT — defeat the beetle dummy
  else if (tutorialStep === TUTORIAL_STEP_COMBAT) {
    if (isAttacking && !tutorialHitLanded) tutorialAttacked = true;
    if (enemies.length > 0 && enemies[0].health < (enemies[0].maxHealth || 999))
      tutorialHitLanded = true;
    if (enemies.length === 0)
      _advanceTutorial(TUTORIAL_STEP_COINS, t("tut_pest_eliminated"));
    if (enemies.length > 0 && pX > TUTORIAL_WALL_X && pY < TUTORIAL_WALL_Y)
      _setTutorialMsg(t("tut_defeat_first"), TUTORIAL_MSG_DEFAULT_MS);
    if (pY >= TUTORIAL_WALL_Y)
      _setTutorialMsg(t("tut_pest_north"), TUTORIAL_MSG_DEFAULT_MS);
  }
  // Step 3: COLLECT COINS
  else if (tutorialStep === TUTORIAL_STEP_COINS) {
    const coinCount = _countCoins();
    if (tutorialCoinSnapshot > 0 && coinCount < tutorialCoinSnapshot) {
      tutorialCoinSnapshot = coinCount;
      if (coinCount > 0) _setTutorialMsg(t("tut_coins_left", coinCount), 2000);
    }
    if (!hasAnyCoins()) {
      isPortalActive = true;
      localStorage.setItem("tutorialComplete", "true");
      _advanceTutorial(TUTORIAL_STEP_PORTAL, t("tut_coins_collected"));
    }
    if (pX < TUTORIAL_GAP1_X && pY < TUTORIAL_WALL_Y)
      _setTutorialMsg(t("tut_coins_east"), TUTORIAL_MSG_DEFAULT_MS);
    if (pY >= TUTORIAL_WALL_Y)
      _setTutorialMsg(t("tut_collect_north"), TUTORIAL_MSG_DEFAULT_MS);
  }
  // Step 4: ENTER PORTAL
  else if (tutorialStep === TUTORIAL_STEP_PORTAL) {
    if (pY >= TUTORIAL_WALL_Y)
      _setTutorialMsg(t("tut_portal_north"), TUTORIAL_MSG_DEFAULT_MS);
    else if (pX < TUTORIAL_GAP1_X + 3 && pY < TUTORIAL_WALL_Y)
      _setTutorialMsg(t("tut_portal_east"), TUTORIAL_MSG_DEFAULT_MS);
  }
}

// Renders the HUD-style tutorial overlay: step list, tooltips, arrows, and floating messages.
function drawTutorial() {
  if (activeTutorial) {
    drawLegacyTutorial();
    return;
  }
  if (!isTutorialMap) return;
  if (!playerPosition) return;

  push();
  const camX = Math.floor(smoothCamX || 0);
  const camY = Math.floor(smoothCamY || 0);
  const pX = playerPosition.x;
  const pY = playerPosition.y;
  const now = millis(); // renamed from 't' to avoid shadowing the t() translation function

  textAlign(CENTER, CENTER);
  if (uiFont) textFont(uiFont);

  const drawTooltip = (txt, tx, ty, opts) => {
    const col = (opts && opts.color) || [255, 215, 0];
    const sz = (opts && opts.size) || 20;
    gTextSize(sz);
    const px = tx * cellSize + cellSize / 2 - camX;
    const py = ty * cellSize - 40 - camY + Math.sin(now * 0.004) * 5;
    const tw = textWidth(txt) + 24;
    const th = sz + 14;
    fill(0, 0, 0, 180);
    noStroke();
    rect(px - tw / 2, py - th / 2, tw, th, 6);
    stroke(col[0], col[1], col[2], 120);
    strokeWeight(1);
    rect(px - tw / 2, py - th / 2, tw, th, 6);
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
    const bounce = Math.sin(now * 0.006) * 8;
    const alpha = 180 + Math.sin(now * 0.008) * 75;
    push();
    translate(px, py - 55 + bounce);
    fill(255, 215, 0, alpha);
    noStroke();
    triangle(0, 18, -10, 0, 10, 0);
    if (label) {
      gTextSize(14);
      const lw = textWidth(label) + 12;
      fill(0, 0, 0, 160);
      noStroke();
      rect(-lw / 2, -26, lw, 20, 4);
      fill(255, 215, 0, alpha);
      text(label, 0, -16);
    }
    pop();
  };

  // --- Step List Panel (left margin) ---
  const stepNames = [
    t("tut_step_move"),
    t("tut_step_sprint"),
    t("tut_step_fight"),
    t("tut_step_collect"),
    t("tut_step_portal"),
  ];
  const listX = 15,
    listY = 80,
    rowH = 22,
    panelW = 110;
  const panelH = stepNames.length * rowH + 16;
  fill(0, 0, 0, 150);
  noStroke();
  rect(listX, listY, panelW, panelH, 6);
  stroke(255, 215, 0, 60);
  strokeWeight(1);
  rect(listX, listY, panelW, panelH, 6);
  noStroke();
  for (let i = 0; i < stepNames.length; i++) {
    const sy = listY + 12 + i * rowH;
    let icon, col;
    if (i < tutorialStep) {
      icon = "\u2713";
      col = [100, 220, 100];
    } else if (i === tutorialStep) {
      icon = "\u25B6";
      col = [255, 215, 0];
    } else {
      icon = "\u00B7";
      col = [140, 140, 140];
    }
    gTextSize(13);
    textAlign(LEFT, CENTER);
    fill(col[0], col[1], col[2]);
    text(icon + "  " + stepNames[i], listX + 10, sy);
  }
  textAlign(CENTER, CENTER);

  // --- Step-specific Prompts & Arrows ---
  const warningActive = tutorialMessage && tutorialMessageTimer > 0;

  if (tutorialStep === TUTORIAL_STEP_MOVE && !warningActive) {
    if (!tutorialMoved) drawPlayerTooltip(t("tut_wasd"));
    else {
      drawPlayerTooltip(t("tut_head_north"), { size: 18 });
      drawArrow(TUTORIAL_GAP1_X, TUTORIAL_WALL_Y, t("tut_gap"));
    }
  } else if (tutorialStep === TUTORIAL_STEP_SPRINT && !warningActive) {
    if (!tutorialSprintDetected)
      drawPlayerTooltip(t("tut_sprint_prompt", _sprintKeyLabel()));
    else drawPlayerTooltip(t("tut_fast"), { color: [100, 255, 100] });
  } else if (tutorialStep === TUTORIAL_STEP_COMBAT && !warningActive) {
    if (enemies.length > 0) {
      const beetle = enemies[0];
      drawArrow(beetle.x, beetle.y, t("tut_target"));
      if (!tutorialHitLanded) {
        drawPlayerTooltip(t("tut_attack_prompt", _attackKeyLabel()));
        drawTooltip(t("tut_approach"), beetle.x, beetle.y + 2, {
          size: 16,
          color: [255, 100, 100],
        });
      } else {
        drawPlayerTooltip(t("tut_keep_attacking"), { color: [255, 150, 50] });
      }
    }
  } else if (tutorialStep === TUTORIAL_STEP_COINS && !warningActive) {
    const coinCount = _countCoins();
    if (coinCount > 0) {
      drawPlayerTooltip(t("tut_collect_coins", coinCount), { size: 18 });
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
  } else if (tutorialStep === TUTORIAL_STEP_PORTAL && !warningActive) {
    if (portalPos) {
      drawArrow(portalPos.x, portalPos.y, t("tut_portal"));
      drawPlayerTooltip(t("tut_enter_portal"), { color: [100, 200, 255] });
    }
  }

  // --- Floating Message Banner ---
  if (tutorialMessage && tutorialMessageTimer > 0) {
    const msgAlpha = Math.min(255, tutorialMessageTimer * 0.5);
    gTextSize(26);
    const mw = textWidth(tutorialMessage) + 30;
    const mx = (virtualW || width / gameScale) / 2;
    const my =
      (virtualH || height / gameScale) * 0.35 + Math.sin(now * 0.003) * 3;
    fill(0, 0, 0, msgAlpha * 0.7);
    noStroke();
    rect(mx - mw / 2, my - 20, mw, 42, 8);
    stroke(255, 215, 0, msgAlpha * 0.5);
    strokeWeight(1);
    rect(mx - mw / 2, my - 20, mw, 42, 8);
    noStroke();
    fill(255, 255, 255, msgAlpha);
    text(tutorialMessage, mx, my);
  }

  pop();
}

// Renders a full-screen modal panel for activeTutorial (the 'welcome' overlay).
function drawLegacyTutorial() {
  if (!activeTutorial) return;
  const vW = virtualW || width / gameScale;
  const vH = virtualH || height / gameScale;
  const panelW = 450,
    panelH = 340;
  const x = (vW - panelW) / 2;
  const y = (vH - panelH) / 2;

  push();
  fill(0, 150);
  noStroke();
  rect(0, 0, vW, vH);
  fill(20, 20, 25, 240);
  stroke(0);
  strokeWeight(4);
  rect(x - 10, y - 10, panelW + 20, panelH + 20, 8);
  stroke(184, 134, 11);
  strokeWeight(2);
  noFill();
  rect(x - 5, y - 5, panelW + 10, panelH + 10, 4);
  if (uiFont) textFont(uiFont);
  fill(255, 215, 0);
  noStroke();
  textAlign(CENTER, TOP);
  gTextSize(28);
  text(activeTutorial.title, x + panelW / 2, y + 25);
  fill(255);
  textAlign(LEFT, TOP);
  gTextSize(18);
  let lineY = y + 80;
  for (const line of activeTutorial.lines) {
    text(line, x + 40, lineY);
    lineY += 28;
  }
  textAlign(CENTER, BOTTOM);
  fill(255, 255, 255, 180);
  gTextSize(14);
  text("Press any key or click to continue", x + panelW / 2, y + panelH - 25);
  pop();
}

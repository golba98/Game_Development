// game-input.js — Player input: attack, mouse, keyboard handlers
// Extracted from 4-Game.js

// --- Input Tuning Constants ---
const COMBO_WINDOW_MS        = 800;  // ms within which successive attacks chain into a combo
const ESC_TOGGLE_DEBOUNCE_MS = 300;  // ms minimum between ESC-triggered pause toggles
const POTION_HEAL_AMOUNT     = 2;    // HP restored when consuming a potion from inventory
const MOUSE_ATTACK_MIN_DIST  = 0.5;  // minimum tile distance from player for mouse-aim to override key direction

// Initiates a player attack: consumes stamina, resolves direction, advances combo counter.
function startPlayerAttack() {
  if (isAttacking || playerAttackCooldownTimer > 0 || isDashing) return;

  // Check stamina
  if (typeof sprintRemainingMs === 'number') {
      const staminaCostMs = (PLAYER_ATTACK_STAMINA_COST / 100) * SPRINT_MAX_DURATION_MS;
      if (sprintRemainingMs < staminaCostMs) {
          verboseLog('[game] Not enough stamina to attack');
          return;
      }
      sprintRemainingMs -= staminaCostMs;
  }

  // Determine attack direction: held keys → mouse position → lastDirection
  const keyLeft  = keyIsDown(playerKeybinds.moveLeft);
  const keyRight = keyIsDown(playerKeybinds.moveRight);
  const keyUp    = keyIsDown(playerKeybinds.moveUp);
  const keyDown  = keyIsDown(playerKeybinds.moveDown);

  let attackDir = null;
  if (keyLeft || keyRight || keyUp || keyDown) {
    const dx = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
    const dy = (keyDown  ? 1 : 0) - (keyUp   ? 1 : 0);
    if (dx !== 0 || dy !== 0) attackDir = deltaToDirection(dx, dy);
  }

  if (!attackDir && playerPosition) {
    try {
      const camX = Math.floor(smoothCamX || 0);
      const camY = Math.floor(smoothCamY || 0);
      const mx = (mouseX / gameScale + camX) / cellSize;
      const my = (mouseY / gameScale + camY) / cellSize;
      const dx = mx - playerPosition.x;
      const dy = my - playerPosition.y;
      if (Math.abs(dx) > MOUSE_ATTACK_MIN_DIST || Math.abs(dy) > MOUSE_ATTACK_MIN_DIST) {
        attackDir = deltaToDirection(dx, dy);
      }
    } catch(e) {}
  }

  if (!attackDir) attackDir = lastDirection || 'S';

  // Lock in direction so hit detection and animation are in sync
  lastDirection = attackDir;
  if (attackDir.includes('W')) facing = 'left';
  else if (attackDir.includes('E')) facing = 'right';

  const now = millis();
  if (now - lastAttackTime < COMBO_WINDOW_MS) {
      playerComboCount = (playerComboCount + 1) % 3;
  } else {
      playerComboCount = 0;
  }
  lastAttackTime = now;

  verboseLog('[game] startPlayerAttack triggered. Combo=', playerComboCount, 'Dir=', lastDirection);

  // Debug check for assets
  const dir = lastDirection || 'S';
  const sheet = attackSheets[dir];
  if (!sheet && dir !== 'E') {
      console.warn('[game] Missing attack sheet for', dir, attackSheets);
  } else if (dir === 'E' && !attackSheets['W']) {
      console.warn('[game] Missing attack sheet for E (fallback W) in', attackSheets);
  }

  isAttacking = true;
  playerAttackTimer = 0;
  playerAttackFrame = 0;
  hasDealtPlayerDamage = false;
  isAttackingEnvironmentalTriggered = false;
  playerAttackCooldownTimer = PLAYER_ATTACK_COOLDOWN_MS;
}

// Handles mouse clicks: focuses window, guards against DOM UI, triggers left-click attack.
function mousePressed() {
  // Ensure keyboard focus is on this window for WASD input
  try { window.focus(); } catch (e) {}

  if (isTerminalOpen) return;
  if (isGameOver) return;

  if (activeTutorial) { activeTutorial = null; return; }

  // Ignore clicks if interacting with DOM UI
  try {
    if (typeof event !== 'undefined' && event.target) {
        const el = event.target;
        if (el.tagName === 'BUTTON' || el.closest('button') || el.closest('.gd-settings-overlay')) return;
    }
  } catch(e) {}

  try {
    if (mouseButton === LEFT) {
        startPlayerAttack();
    }
  } catch (e) {}
}

// Toggles the pause / in-game menu when Escape is pressed, with debounce.
function togglePauseMenuFromEscape() {
  const now = Date.now();
  if (now - _lastEscToggleAt < ESC_TOGGLE_DEBOUNCE_MS) return;
  _lastEscToggleAt = now;

  try {
    try { if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize(); } catch(e) {}
    try { if (typeof persistSavedSettings === 'function') persistSavedSettings(true); } catch(e) {}
    if (settingsOverlayDiv) {
      if (settingsOverlayDiv.closeZoomPanel) settingsOverlayDiv.closeZoomPanel();
      else settingsOverlayDiv.remove();
      settingsOverlayDiv = null;
      openInGameMenu();
      return;
    }

    if (inGameMenuVisible) {
      closeInGameMenu();
    } else {
      openInGameMenu();
    }
  } catch (e) { console.warn('[game] toggling inGameMenuVisible failed', e); }
}

// Routes keyboard shortcuts: terminal toggle, jump, map regen, asset toggle, inventory use.
function keyPressed() {
  if (key === "'" && keyIsDown(CONTROL)) {
      toggleTerminal();
      return false;
  }
  if (isTerminalOpen) return; // Disable other inputs while terminal is open

  if (activeTutorial) { activeTutorial = null; return false; }

  if (isGameOver) return;
  if (keyCode === playerKeybinds.jump && !isJumping && !isMoving) {

    isJumping = true;
    jumpFrame = 0;
    jumpTimer = 0;

    // Move forward one tile in the jump direction if possible
    try {
      const keyLeft  = keyIsDown(playerKeybinds.moveLeft);
      const keyRight = keyIsDown(playerKeybinds.moveRight);
      const keyUp    = keyIsDown(playerKeybinds.moveUp);
      const keyDown  = keyIsDown(playerKeybinds.moveDown);
      const dx = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
      const dy = (keyDown  ? 1 : 0) - (keyUp   ? 1 : 0);

      if (dx !== 0 || dy !== 0) {
        const dir = deltaToDirection(dx, dy);
        const d = directionToDelta(dir);
        const maxTileX = logicalW - 1;
        const maxTileY = logicalH - 1;
        let targetX = playerPosition.x + d.dx;
        let targetY = playerPosition.y + d.dy;
        targetX = Math.max(0, Math.min(targetX, maxTileX));
        targetY = Math.max(0, Math.min(targetY, maxTileY));
        if (canMoveTo(playerPosition.x, playerPosition.y, targetX, targetY)) {
          handleItemInteraction(targetX, targetY);
          const prevX = playerPosition.x;
          const prevY = playerPosition.y;
          if (isMoving) {
            queuedMove = { prevX, prevY, targetX, targetY };
          } else {
            playerPosition.x = targetX;
            playerPosition.y = targetY;
            lastMoveDX = playerPosition.x - prevX;
            lastMoveDY = playerPosition.y - prevY;
            lastDirection = deltaToDirection(lastMoveDX, lastMoveDY);
            startMoveVisual(prevX, prevY, playerPosition.x, playerPosition.y);
          }
        }
      }
    } catch (e) { console.warn('[game] jump-forward movement failed', e); }
    return;
  }
  if (key === 'm' || key === 'M') {
      showMinimap = !showMinimap;
      return;
  }

  if (key === 'f' || key === 'F') {
    fullscreen(!fullscreen());
    return;
  }

  if (key === 't' || key === 'T') {
    try {
      toggleCustomAssetsRuntime();
      try { createMapImage(); redraw(); } catch (e) { console.warn('[game] createMapImage failed after custom asset toggle', e); }
    } catch (e) { console.warn('[game] error toggling custom assets', e); }
    return;
  }

  if (key === 'p' || key === 'P') {
    try {
      verboseLog('[game] key P pressed — generating new map (previous autosave will be archived)');
      nextGenerateIsManual = true;
      generateMap();
    } catch (e) {
      console.warn('[game] generateMap() failed from key press', e);
    }
    return;
  }

  if (key === 'o' || key === 'O') {
    try {
      verboseLog('[game] debug key O pressed — forcing inGameMenuVisible = true');
      inGameMenuVisible = true;
    } catch (e) { console.warn('[game] debug O failed', e); }
    return;
  }

  // --- Inventory Usage ---
  if (key === '1') {
      if (playerInventory && playerInventory['potion'] > 0) {
          if (playerHealth < maxHealth) {
              playerInventory['potion']--;
              playerHealth = Math.min(maxHealth, playerHealth + POTION_HEAL_AMOUNT);
              spawnDamageText(`+${POTION_HEAL_AMOUNT} HP`, playerPosition.x, playerPosition.y, [0, 255, 0]);
              try { playClickSFX(); } catch(e) {}
          } else {
              spawnDamageText(t('full_hp'), playerPosition.x, playerPosition.y, [200, 200, 200]);
          }
      }
      return;
  }
  if (key === '2') {
      if (playerInventory && playerInventory['speed'] > 0) {
          playerInventory['speed']--;
          if (typeof sprintRemainingMs === 'number') {
             sprintRemainingMs = SPRINT_MAX_DURATION_MS;
             sprintActive = true;
          }
          spawnDamageText(t('speed_up'), playerPosition.x, playerPosition.y, [255, 215, 0]);
          try { playClickSFX(); } catch(e) {}
      }
      return;
  }

  if (keyCode === playerKeybinds.cut) {
    startPlayerAttack();
    return;
  }
}


// ── Escape key handler (simple) ──
try {
  window.addEventListener('keydown', (ev) => {
    if (ev && ev.key === 'Escape') {
      ev.preventDefault();
      if (!ev.repeat) togglePauseMenuFromEscape();
    }
  }, { capture: true });
} catch (e) { /* ignore */ }


// ── WASD + P key handler ──
window.addEventListener('keydown', (ev) => {
  const k = ev.key ? ev.key.toUpperCase() : '';
  if (k === 'W' || k === 'A' || k === 'S' || k === 'D') {
    try { tryMoveDirection(k); } catch (e) {}
  }
  if (k === 'P') {
    verboseLog('[game] P pressed - Starting Phase 1');
    genPhase = 1;
    return;
  }
});

// game-input.js — Player input: attack, mouse, keyboard handlers
// Extracted from 4-Game.js

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
  const nowLeft  = keyIsDown(playerKeybinds.moveLeft);
  const nowRight = keyIsDown(playerKeybinds.moveRight);
  const nowUp    = keyIsDown(playerKeybinds.moveUp);
  const nowDown  = keyIsDown(playerKeybinds.moveDown);

  let attackDir = null;
  if (nowLeft || nowRight || nowUp || nowDown) {
    const dx = (nowRight ? 1 : 0) - (nowLeft ? 1 : 0);
    const dy = (nowDown ? 1 : 0) - (nowUp ? 1 : 0);
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
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) attackDir = deltaToDirection(dx, dy);
    } catch(e) {}
  }

  if (!attackDir) attackDir = lastDirection || 'S';

  // Lock in direction so hit detection and animation are in sync
  lastDirection = attackDir;
  if (attackDir.includes('W')) facing = 'left';
  else if (attackDir.includes('E')) facing = 'right';

  const now = millis();
  // Combo window: 800ms
  if (now - lastAttackTime < 800) {
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

function togglePauseMenuFromEscape() {
  const now = Date.now();
  if (now - _lastEscToggleAt < 50) return; 
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


    try {
      const nowA = (typeof keyIsDown === 'function') ? keyIsDown(playerKeybinds.moveLeft) : false;
      const nowD = (typeof keyIsDown === 'function') ? keyIsDown(playerKeybinds.moveRight) : false;
      const nowW = (typeof keyIsDown === 'function') ? keyIsDown(playerKeybinds.moveUp) : false;
      const nowS = (typeof keyIsDown === 'function') ? keyIsDown(playerKeybinds.moveDown) : false;
      const dx = (nowD ? 1 : 0) - (nowA ? 1 : 0);
      const dy = (nowS ? 1 : 0) - (nowW ? 1 : 0);
      
      if (dx === 0 && dy === 0) {
        
      } else {
        const dir = deltaToDirection(dx, dy);
        const d = directionToDelta(dir);
      const maxTileX = (logicalW || 0) - 1;
      const maxTileY = (logicalH || 0) - 1;
      let targetX = (typeof playerPosition.x === 'number' ? playerPosition.x : 0) + d.dx;
      let targetY = (typeof playerPosition.y === 'number' ? playerPosition.y : 0) + d.dy;
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
  if (key === 'Escape' || keyCode === 27) { togglePauseMenuFromEscape(); return false; }

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
  
  // INVENTORY USAGE
  if (key === '1') {
      if (playerInventory && playerInventory['potion'] > 0) {
          if (playerHealth < maxHealth) {
              playerInventory['potion']--;
              playerHealth = Math.min(maxHealth, playerHealth + 2); // Potions heal 2
              spawnDamageText("+2 HP", playerPosition.x, playerPosition.y, [0, 255, 0]);
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
      togglePauseMenuFromEscape();
    }
  }, { capture: true });
} catch (e) { /* ignore */ }


// ── WASD + P key handler ──
window.addEventListener('keydown', (ev) => {
  const k = ev.key ? ev.key.toUpperCase() : '';
  if (k === 'W' || k === 'A' || k === 'S' || k === 'D') {
    try { tryMoveDirection(k); } catch (e) {  }
  }
  if (k === 'P') {
    verboseLog('[game] P pressed - Starting Phase 1');
    genPhase = 1; 
    return;
}
});


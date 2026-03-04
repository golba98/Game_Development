// game-movement.js — Player movement, collision, interpolation, rendering, pathfinding
// Extracted from 4-Game.js

function handleMovement() {
  if (isTerminalOpen) return;
  updateSprintState();
  if (dashCooldown > 0) dashCooldown -= gameDelta;
  if (isDashing) {
      dashTimer -= gameDelta;
      if (dashTimer <= 0) isDashing = false;
  }

  if (isJumping || (isMoving && (millis() - lastMoveTime < getActiveMoveCooldownMs()))) return;
  const nowA = keyIsDown(playerKeybinds.moveLeft);
  const nowD = keyIsDown(playerKeybinds.moveRight);
  const nowW = keyIsDown(playerKeybinds.moveUp);
  const nowS = keyIsDown(playerKeybinds.moveDown);
  const shiftHeld = keyIsDown(playerKeybinds.sprint);
  const now = millis();

  // Dash trigger
  if (shiftHeld && !isDashing && dashCooldown <= 0 && (nowA || nowD || nowW || nowS)) {
      isDashing = true;
      dashTimer = DASH_DURATION;
      dashCooldown = DASH_COOLDOWN;
      verboseLog('[game] DASH!');
  }

  let moved = false;
  let targetX = playerPosition.x;
  let targetY = playerPosition.y;
  const maxTileX = (logicalW || 0) - 1;
  const maxTileY = (logicalH || 0) - 1;
  function keyTriggered(keyNow, prevKey, holdObj) {
    if (keyNow && !prevKey) {
      holdObj.start = now;
      holdObj.last = now;
      return true;
    }
    if (keyNow && prevKey) {
      if (holdObj.start > 0 && (now - holdObj.start >= HOLD_INITIAL_DELAY_MS) && (now - holdObj.last >= HOLD_REPEAT_INTERVAL_MS)) {
        holdObj.last = now;
        return true;
      }
      return false;
    }
    holdObj.start = 0;
    holdObj.last = 0;
    return false;
  }
  const A_trig = keyTriggered(nowA, prevKeyA, holdState.A);
  const D_trig = keyTriggered(nowD, prevKeyD, holdState.D);
  const W_trig = keyTriggered(nowW, prevKeyW, holdState.W);
  const S_trig = keyTriggered(nowS, prevKeyS, holdState.S);
  if (A_trig) { facing = 'left'; targetX--; moved = true; }
  else if (D_trig) { facing = 'right'; targetX++; moved = true; }
  const upTrig   = invertYAxis ? S_trig : W_trig;
  const downTrig = invertYAxis ? W_trig : S_trig;
  if (upTrig)   { targetY--; moved = true; }
  else if (downTrig) { targetY++; moved = true; }
  if (targetX < 0) targetX = 0;
  if (targetY < 0) targetY = 0;
  if (targetX > maxTileX) targetX = maxTileX;
  if (targetY > maxTileY) targetY = maxTileY;
  if (moved) {
    if (canMoveTo(playerPosition.x, playerPosition.y, targetX, targetY)) {
      handleItemInteraction(targetX, targetY);
      const prevX = playerPosition.x;
      const prevY = playerPosition.y;
      if (isMoving) {
        const qx = Math.max(0, Math.min(targetX, maxTileX));
        const qy = Math.max(0, Math.min(targetY, maxTileY));
        queuedMove = { prevX, prevY, targetX: qx, targetY: qy };
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
  prevKeyA = nowA;
  prevKeyD = nowD;
  prevKeyW = nowW;
  prevKeyS = nowS;
}

function tryMoveDirection(keyChar) {
  if (!playerPosition) return;
  const k = keyChar ? keyChar.toUpperCase() : '';
  let targetX = playerPosition.x;
  let targetY = playerPosition.y;
  if (k === 'A') { facing = 'left'; targetX--; }
  else if (k === 'D') { facing = 'right'; targetX++; }
  else if (k === 'W') { targetY--; }
  else if (k === 'S') { targetY++; }
  else return;
  const maxTileX = (logicalW || 0) - 1;
  const maxTileY = (logicalH || 0) - 1;
  targetX = Math.max(0, Math.min(targetX, maxTileX));
  targetY = Math.max(0, Math.min(targetY, maxTileY));
  if (!canMoveTo(playerPosition.x, playerPosition.y, targetX, targetY)) return;
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
  const now = millis();
  if (k === 'A') { holdState.A.start = now; holdState.A.last = now; prevKeyA = true; }
  if (k === 'D') { holdState.D.start = now; holdState.D.last = now; prevKeyD = true; }
  if (k === 'W') { holdState.W.start = now; holdState.W.last = now; prevKeyW = true; }
  if (k === 'S') { holdState.S.start = now; holdState.S.last = now; prevKeyS = true; }
}

function handleItemInteraction(targetX, targetY) {
  const tileIdx = targetY * logicalW + targetX;
  const tileState = mapStates[tileIdx];
  if (!ITEM_DATA.hasOwnProperty(tileState)) return;
  const item = ITEM_DATA[tileState];
  verboseLog(`Player interacted with ${item.label}`);
  let consumed = false;

  switch (tileState) {
    case TILE_TYPES.CHEST:
      spawnDamageText(t('empty'), targetX, targetY, [200, 200, 200]);
      consumed = true;
      break;
    case TILE_TYPES.HEALTH:
      if (playerHealth < maxHealth) {
          playerHealth = Math.min(maxHealth, playerHealth + 1);
          lastHealthChange = millis(); // Trigger UI pulse
          spawnDamageText("+1 HP", targetX, targetY, [0, 255, 0]);
          consumed = true;
      } else {
          // Inventory
          if (!playerInventory) playerInventory = { 'potion': 0, 'speed': 0 };
          playerInventory['potion'] = (playerInventory['potion'] || 0) + 1;
          spawnDamageText(t('got_potion'), targetX, targetY, [100, 255, 255]);
          consumed = true;
      }
      screenShakeTimer = 100; screenShakeAmount = 3;
      break;
    case TILE_TYPES.POWERUP:
      // Inventory
      if (!playerInventory) playerInventory = { 'potion': 0, 'speed': 0 };
      playerInventory['speed'] = (playerInventory['speed'] || 0) + 1;
      spawnDamageText(t('got_boost'), targetX, targetY, [255, 215, 0]);
      consumed = true;
      screenShakeTimer = 150; screenShakeAmount = 5;
      break;
    case TILE_TYPES.COIN:
      playerScore += 10;
      lastScoreChange = millis(); // Trigger UI pulse
      spawnDamageText("+10 GOLD", targetX, targetY, [255, 255, 0]);
      consumed = true;
      break;
  }
  
  if (consumed) {
      const underlyingTerrain = terrainLayer[tileIdx] || TILE_TYPES.GRASS;
      mapStates[tileIdx] = underlyingTerrain;
      drawTileToMap(targetX, targetY); // Optimized update
  }
}

function canMoveTo(fromX, fromY, toX, toY) {
  const fromState = getTileState(fromX, fromY);
  const toState = getTileState(toX, toY);
  const targetIdx = toY * logicalW + toX;
  const currentIdx = fromY * logicalW + fromX;
  
  const hillMin = (typeof TILE_TYPES !== 'undefined') ? TILE_TYPES.HILL_NORTH : 13;
  const hillMax = (typeof TILE_TYPES !== 'undefined') ? TILE_TYPES.HILL_NORTHWEST : 20;
  const cliffTile = (typeof TILE_TYPES !== 'undefined') ? TILE_TYPES.CLIFF : 6;
  const isToHill = (toState >= hillMin && toState <= hillMax) || (toState === cliffTile);
  const isFromHill = (fromState >= hillMin && fromState <= hillMax) || (fromState === cliffTile);

  const logTile = (typeof TILE_TYPES !== 'undefined') ? TILE_TYPES.LOG : 8;
  const rampTile = (typeof TILE_TYPES !== 'undefined') ? TILE_TYPES.RAMP : 7;
  const isToLogOrRamp = (toState === logTile || toState === rampTile);
  const isFromLogOrRamp = (fromState === logTile || fromState === rampTile);

  const isToObstacle = decorativeObstacleTiles.has(targetIdx);
  const isFromObstacle = decorativeObstacleTiles.has(currentIdx);

  // 1. Decorative Obstacles
  if (isToObstacle) {
    if (isJumping || isFromObstacle) return true; // Can jump over/onto or walk between obstacles
    return false;
  }
  
  // 2. Hills (Cliffs)
  if (isToHill) {
    // Can move to a hill if jumping OR if already on a hill
    if (isJumping || isFromHill) return true;
    return false;
  }

  // 3. Logs & Ramps (Bridges)
  if (isToLogOrRamp) {
    // Bridges should always be walkable from anywhere
    return true;
  }

  // 4. Enemies
  if (enemies && enemies.length > 0) {
    for (const e of enemies) {
      // If enemy is effectively at the target tile
      if (Math.floor(e.x) === toX && Math.floor(e.y) === toY) {
        return false;
      }
    }
  }

  // 5. General Solidarity
  if (isSolid(toState)) return false;
  
  try {
    if (EDGE_LAYER_ENABLED && edgeLayer && logicalW && logicalH) {
      if (toX >= 0 && toX < logicalW && toY >= 0 && toY < logicalH) {
        const idx = toY * logicalW + toX;
        if (edgeLayer[idx]) return false;
      }
    }
  } catch (e) {  }
  return true;
}

function isSolid(tileState) {
  
  if (WALKABLE_TILES.has(tileState)) {
    return false;
  }

  
  if (ITEM_DATA.hasOwnProperty(tileState)) {
    return false;
  }
  
  
  if (tileState === TILE_TYPES.MOB) {
      return true;
  }

  
  return true;
}

function deltaToDirection(dx, dy) {
  const eps = 0.01;
  if (Math.abs(dx) <= eps && Math.abs(dy) <= eps) return lastDirection || 'S';
  if (dx < -eps && dy > eps) return 'SW';
  if (dx < -eps && Math.abs(dy) <= eps) return 'W';
  if (dx < -eps && dy < -eps) return 'NW';
  if (Math.abs(dx) <= eps && dy < -eps) return 'N';
  if (Math.abs(dx) <= eps && dy > eps) return 'S';
  if (dx > eps && dy > eps) return 'SE';
  if (dx > eps && Math.abs(dy) <= eps) return 'E';
  if (dx > eps && dy < -eps) return 'NE';
  return 'S';
}

function directionToDelta(dir) {
  
  switch ((dir || '').toUpperCase()) {
    case 'N':  return { dx: 0, dy: -1 };
    case 'NE': return { dx: 1, dy: -1 };
    case 'E':  return { dx: 1, dy: 0 };
    case 'SE': return { dx: 1, dy: 1 };
    case 'S':  return { dx: 0, dy: 1 };
    case 'SW': return { dx: -1, dy: 1 };
    case 'W':  return { dx: -1, dy: 0 };
    case 'NW': return { dx: -1, dy: -1 };
    default:   return { dx: 0, dy: 0 };
  }
}

function startMoveVisual(prevX, prevY, newX, newY) {
  lastMoveDurationMs = getActiveMoveDurationMs();
  renderStartX = isNaN(renderX) ? prevX : renderX;
  renderStartY = isNaN(renderY) ? prevY : renderY;
  renderTargetX = newX;
  renderTargetY = newY;
  moveStartMillis = millis();
  isMoving = true;
}

function updateMovementInterpolation() {
  if (!isMoving) return;
  const elapsed = millis() - moveStartMillis;
  const duration = Math.max(1, lastMoveDurationMs);
  const t = constrain(elapsed / duration, 0, 1);
  renderX = lerp(renderStartX, renderTargetX, t);
  renderY = lerp(renderStartY, renderTargetY, t);
  if (t >= 1) {
    isMoving = false;
    renderStartX = renderTargetX;
    renderStartY = renderTargetY;
    if (queuedMove) {
      const q = queuedMove;
      queuedMove = null;
      playerPosition.x = q.targetX;
      playerPosition.y = q.targetY;
      lastMoveDX = playerPosition.x - q.prevX;
      lastMoveDY = playerPosition.y - q.prevY;
      lastDirection = deltaToDirection(lastMoveDX, lastMoveDY);
      startMoveVisual(renderStartX, renderStartY, playerPosition.x, playerPosition.y);
    } else {
      lastMoveTime = millis();
    }
  }
}

function updateSprintState() {
  const now = millis();
  const shiftHeld = keyIsDown(playerKeybinds.sprint);

  if (typeof sprintLastUpdate !== 'number' || sprintLastUpdate <= 0) sprintLastUpdate = now;
  const dt = Math.max(0, now - sprintLastUpdate);
  sprintLastUpdate = now;

  if (sprintActive) {
  
    sprintRemainingMs = Math.max(0, sprintRemainingMs - dt);
    if (!shiftHeld || sprintRemainingMs <= 0) {
      sprintActive = false;
      sprintCooldownUntil = now + SPRINT_COOLDOWN_MS;
    }
  } else {

    if (sprintRemainingMs < SPRINT_MAX_DURATION_MS) {
      sprintRemainingMs = Math.min(SPRINT_MAX_DURATION_MS, sprintRemainingMs + dt);
    }


    if (sprintRemainingMs >= SPRINT_MAX_DURATION_MS) {
      sprintRemainingMs = SPRINT_MAX_DURATION_MS;
      sprintCooldownUntil = 0;
    }


    if (shiftHeld && now >= sprintCooldownUntil && sprintRemainingMs > 0) {
      sprintActive = true;
      sprintLastUpdate = now;
    }
  }

  // Update smooth sprint percentage for UI with an adaptive lerp factor
  const targetPct = (typeof sprintRemainingMs === 'number' && SPRINT_MAX_DURATION_MS > 0) ? (sprintRemainingMs / SPRINT_MAX_DURATION_MS) : 0;
  // Adaptive lerp based on ~60fps baseline
  const t = 1 - Math.pow(1 - 0.12, gameDelta / 16.67);
  smoothSprintPct = lerp(smoothSprintPct, targetPct, t);
}

function getActiveMoveDurationMs() {
  if (isDashing) return 50; // Very fast dash
  const base = sprintActive ? SPRINT_MOVE_DURATION_MS : BASE_MOVE_DURATION_MS;
  let multiplier = 1.0;
  if (playerPosition && getTileState(playerPosition.x, playerPosition.y) === TILE_TYPES.RIVER) {
    multiplier = 1.5;
  }
  const sensMultiplier = 1.0 - (sensitivitySetting - 5) * 0.06;
  return Math.max(1, Math.round(base * multiplier * getCellSizeSpeedScale() * sensMultiplier));
}

function getActiveMoveCooldownMs() {
  const base = sprintActive ? SPRINT_MOVE_COOLDOWN_MS : BASE_MOVE_COOLDOWN_MS;
  let multiplier = 1.0;
  if (playerPosition && getTileState(playerPosition.x, playerPosition.y) === TILE_TYPES.RIVER) {
    multiplier = 1.5;
  }
  const sensMultiplier = 1.0 - (sensitivitySetting - 5) * 0.06;
  return Math.max(0, Math.round(base * multiplier * getCellSizeSpeedScale() * sensMultiplier));
}

function getCellSizeSpeedScale() {
  const BASE_CELL_SIZE = 32;
  if (typeof cellSize !== 'number' || cellSize <= 0) return 1;
  return cellSize / BASE_CELL_SIZE;
}

function drawPlayer() {
  if (playerHurtTimer > 0) {
     tint(255, 0, 0);
     playerHurtTimer -= gameDelta;
  }
  _drawPlayerInternal();
  noTint();
}

function _drawPlayerInternal() {
  const inputLeft  = keyIsDown && keyIsDown(playerKeybinds.moveLeft);
  const inputRight = keyIsDown && keyIsDown(playerKeybinds.moveRight);
  const inputUp    = keyIsDown && keyIsDown(playerKeybinds.moveUp);
  const inputDown  = keyIsDown && keyIsDown(playerKeybinds.moveDown);
  const inputWalking = !!(inputLeft || inputRight || inputUp || inputDown);
  const drawTileX = isMoving ? renderX : playerPosition.x;
  const drawTileY = isMoving ? renderY : playerPosition.y;
  const destX = drawTileX * cellSize;
  let destY = drawTileY * cellSize;

  // Determine if in water for visual clipping
  let inWater = false;
  if (getTileState(Math.floor(drawTileX + 0.5), Math.floor(drawTileY + 0.5)) === TILE_TYPES.RIVER) {
      inWater = true;
  }
  const clipFactor = inWater ? 0.75 : 1.0; // Show only top 75% if in water

  // --- WATER RIPPLES ---
  if (inWater && (isMoving || isJumping || inputWalking)) {
      rippleTimer -= gameDelta;
      if (rippleTimer <= 0) {
          spawnRipple(drawTileX, drawTileY);
          rippleTimer = 300; // Spawn every 300ms
      }
  }

  // --- UNIFIED SCALING ---
  // We use a fixed scale factor for all animations to ensure pixel consistency.
  // 20px is the reference character height for low-res sprites.
  const SPRITE_SCALE = (cellSize * 1.25) / 20; 
  const ATTACK_SCALE = SPRITE_SCALE * 0.17; // Matches character body size across resolutions

  // --- ATTACK ANIMATION ---
  if (isAttacking) {
    playerAttackTimer += gameDelta;
    if (playerAttackTimer > 80) { // Speed of attack animation
      playerAttackTimer = 0;
      playerAttackFrame++;
    }
    
    // Check if animation done
    const maxAttackFrames = 4; 
    if (playerAttackFrame >= maxAttackFrames) {
      isAttacking = false;
      playerAttackFrame = 0;
    } else {
        // HIT DETECTION (Damage frames 1 or 2)
        if ((playerAttackFrame === 1 || playerAttackFrame === 2) && !hasDealtPlayerDamage) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                const dist = Math.hypot(e.x - playerPosition.x, e.y - playerPosition.y);
                
                // ADJUSTMENT: Boss Beetle is large (80px), so it needs a bigger hit-range than normal mobs
                const attackRange = (e.type === 'beetle') ? 3.0 : 1.8; 
                
                if (dist < attackRange) {
                    const dx = e.x - playerPosition.x;
                    const dy = e.y - playerPosition.y;
                    const dir = lastDirection || 'S';
                    let angleMatches = false;

                    // Boss Beetle is large — wider auto-hit and angle tolerance
                    const autoHitDist = (e.type === 'beetle') ? 2.0 : 0.7;
                    const angleTolerance = (e.type === 'beetle') ? 2.5 : 1.2;

                    if (dist < autoHitDist) angleMatches = true; // Always hit if close enough
                    else if (dir === 'N' && dy < 0 && Math.abs(dx) < angleTolerance) angleMatches = true;
                    else if (dir === 'S' && dy > 0 && Math.abs(dx) < angleTolerance) angleMatches = true;
                    else if (dir === 'W' && dx < 0 && Math.abs(dy) < angleTolerance) angleMatches = true;
                    else if (dir === 'E' && dx > 0 && Math.abs(dy) < angleTolerance) angleMatches = true;
                    else if (dir === 'NE' && dx > 0 && dy < 0) angleMatches = true;
                    else if (dir === 'NW' && dx < 0 && dy < 0) angleMatches = true;
                    else if (dir === 'SE' && dx > 0 && dy > 0) angleMatches = true;
                    else if (dir === 'SW' && dx < 0 && dy > 0) angleMatches = true;
                    
                    if (angleMatches) {
                        // Combo Damage (3rd hit deals double)
                        let damage = 1;
                        if (playerComboCount === 2) {
                            damage = 2;
                            verboseLog('[game] CRITICAL HIT! Combo step 3');
                        }
                        
                        e.health = (e.health || 1) - damage;
                        e.hurtTimer = 250; 
                        screenShakeTimer = 120; 
                        screenShakeAmount = playerComboCount === 2 ? 8 : 5;  
                        
                        // VFX: Damage Text
                        spawnDamageText(`-${damage}`, e.x, e.y, damage === 2 ? [255, 200, 0] : [255, 255, 255]);
                        
                        // Knockback logic
                        const dir = lastDirection || 'S';
                        const kbDist = 0.6;
                        let kdx = 0, kdy = 0;
                        if (dir.includes('N')) kdy = -kbDist;
                        if (dir.includes('S')) kdy = kbDist;
                        if (dir.includes('W')) kdx = -kbDist;
                        if (dir.includes('E')) kdx = kbDist;
                        
                        const targetX = e.x + kdx;
                        const targetY = e.y + kdy;
                        
                        if (targetX >= 0 && targetX < logicalW && targetY >= 0 && targetY < logicalH) {
                            const ts = getTileState(Math.floor(targetX), Math.floor(targetY));
                            if (isSolid(ts)) {
                                // Knocked into wall -> Instant Death
                                e.health = 0;
                                spawnDamageText(t('splat'), e.x, e.y, [255, 50, 50]);
                            } else if (ts !== TILE_TYPES.RIVER) {
                                e.x = targetX;
                                e.y = targetY;
                            }
                        }

                                                    if (e.health <= 0) {
                                                        spawnSplat(e.x, e.y, e.type === 'mantis' ? 'acid' : 'egg');
                                                        
                                                        // Loot Drop Logic
                                                        if (random() < 0.3) { // 30% drop chance
                                                            const dropType = random() < 0.8 ? TILE_TYPES.HEALTH : TILE_TYPES.POWERUP;
                                                            const idx = Math.floor(e.y) * logicalW + Math.floor(e.x);
                                                            // Only drop if on grass or similar
                                                            const currentTile = mapStates[idx];
                                                                                                if (currentTile === TILE_TYPES.GRASS || currentTile === TILE_TYPES.FLOWERS) {
                                                                                                    mapStates[idx] = dropType;
                                                                                                    spawnDamageText("★", e.x, e.y, [255, 255, 0]);
                                                                                                    drawTileToMap(Math.floor(e.x), Math.floor(e.y)); // Optimized update
                                                                                                }                                                        }
                        
                                                        enemies.splice(i, 1);
                                                        verboseLog('[game] Enemy defeated!');
                                                    } else {                            verboseLog('[game] Enemy hit! Health remaining:', e.health);
                        }
                        hasDealtPlayerDamage = true; // Deal damage only once per click
                    }
                }
            }
        }

        // --- ENVIRONMENTAL INTERACTION (Cut grass/flowers) ---
        if ((playerAttackFrame === 1 || playerAttackFrame === 2) && !isAttackingEnvironmentalTriggered) {
            const punchDist = 1.2;
            const punchDir = lastDirection || 'S';
            const pd = directionToDelta(punchDir);
            const cutX = Math.floor(playerPosition.x + pd.dx * punchDist);
            const cutY = Math.floor(playerPosition.y + pd.dy * punchDist);
            
            if (cutX >= 0 && cutX < logicalW && cutY >= 0 && cutY < logicalH) {
                const idx = cutY * logicalW + cutX;
                const tile = mapStates[idx];
                if (tile === TILE_TYPES.FLOWERS) {
                    mapStates[idx] = TILE_TYPES.GRASS;
                    spawnDamageText("✂", cutX, cutY, [100, 255, 100]);
                    
                    // 15% chance to drop a coin or heart
                    const lootRoll = Math.random();
                    if (lootRoll < 0.1) {
                        mapStates[idx] = TILE_TYPES.COIN;
                    } else if (lootRoll < 0.15) {
                        mapStates[idx] = TILE_TYPES.HEALTH;
                    }
                    
                    drawTileToMap(cutX, cutY); // Optimized update
                }
            }
            isAttackingEnvironmentalTriggered = true;
        }

        // Draw Attack
        let dir = lastDirection || 'S';
        let sheet = attackSheets[dir];
        let flip = false;
        
        // FIX: attack_west.png appears to be East-facing (Right).
        // If attacking West, we must FLIP it to face Left.
        if (dir === 'W') {
             flip = true;
        }

        // Fallback for East if null: Use attack_west.png (which is East-facing), so DO NOT flip.
        if (!sheet && dir === 'E') {
            sheet = attackSheets['W'];
            flip = false; 
        }

        if (sheet && sheet.width > 0 && sheet.height > 0) {
            const cols = 4; // User specified 4 frames
            const fw = sheet.width / cols;
            const fh = sheet.height;
            const sx = playerAttackFrame * fw;
            const sy = 0;
            
            const drawW = fw * ATTACK_SCALE;
            const drawH = fh * ATTACK_SCALE;
            
            if (!Number.isFinite(drawW) || !Number.isFinite(drawH)) return;

            const finalDrawH = drawH * clipFactor;
            // Center horizontally, align bottom
            const drawX = destX + (cellSize / 2) - (drawW / 2);
            const drawY = destY + cellSize - drawH; // Align sprite bottom with tile bottom (unclipped height)

            push(); noSmooth();
            if (flip) {
                // Flip horizontally: translate to center, scale, translate back
                translate(drawX + drawW/2, drawY + finalDrawH/2);
                scale(-1, 1);
                image(sheet, -drawW/2, -finalDrawH/2, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
            } else {
                image(sheet, drawX, drawY, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
            }
            pop();
            return; // Skip other animations
        }
    }
  }

  if (isJumping) {
    const jumpProgress = (jumpTimer % JUMP_DURATION) / JUMP_DURATION;
    const jumpHeight = Math.sin(jumpProgress * Math.PI) * cellSize * 1.5; 
    destY -= jumpHeight;

    jumpTimer += gameDelta;
    if (jumpTimer >= JUMP_DURATION) {
      isJumping = false;
      jumpTimer = 0;
    }

    jumpFrame = Math.floor((jumpTimer / JUMP_ANIM_SPEED) % JUMP_FRAME_COUNT);
    
    const dir = lastDirection || 'S';
    const sheet = jumpSheets[dir];
    if (sheet) {
        const fw = sheet.width / JUMP_FRAME_COUNT;
        const fh = sheet.height;
        const sx = jumpFrame * fw;
        const sy = 0;
        const drawW = fw * SPRITE_SCALE;
        const drawH = fh * SPRITE_SCALE;
        const finalDrawH = drawH * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - drawH; // Top stays same
        push(); noSmooth();
        image(sheet, drawX, drawY, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        pop();
        return; 
    }
  }

  let dir = null;
  if (isMoving) {
    const dx = renderTargetX - renderStartX;
    const dy = renderTargetY - renderStartY;
    dir = deltaToDirection(dx, dy);
  } else if (inputWalking) {
    const dx = (inputRight ? 1 : 0) + (inputLeft ? -1 : 0);
    const dy = (inputDown ? 1 : 0) + (inputUp ? -1 : 0);
    dir = deltaToDirection(dx, dy);
    if (dx < 0) facing = 'left';
    else if (dx > 0) facing = 'right';
  } else {
    dir = lastDirection || 'S';
  }
  const movingForAnimation = isMoving || inputWalking;
  const action = movingForAnimation ? (sprintActive ? 'run' : 'walk') : 'idle';
  let cols = IDLE_SHEET_COLS;
  if (action === 'walk') cols = WALK_SHEET_COLS;
  else if (action === 'run') cols = RUN_SHEET_COLS;
  playerAnimTimer += gameDelta;
  if (playerAnimTimer >= playerAnimSpeed) {
    playerAnimTimer -= playerAnimSpeed;
    playerAnimFrame = (playerAnimFrame + 1) % cols;
  }
  const colIndex = Math.floor(playerAnimFrame) % cols;
  if (movingForAnimation) {
    if (action === 'walk') {
      const frameImgWalk = (walkFrames[dir] && walkFrames[dir][colIndex]) ? walkFrames[dir][colIndex] : null;
      if (frameImgWalk) {
        const fw = frameImgWalk.width;
        const fh = frameImgWalk.height;
        const drawW = fw * SPRITE_SCALE;
        const drawH = fh * SPRITE_SCALE;
        const finalDrawH = drawH * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - drawH;
        push(); noSmooth(); 
        image(frameImgWalk, drawX, drawY, drawW, finalDrawH, 0, 0, fw, fh * clipFactor); 
        pop();
        return;
      }
      const dirSheetWalk = walkSheets[dir] || null;
      if (dirSheetWalk) {
        const sheet = dirSheetWalk;
        const fw = sheet.width / cols;
        const fh = sheet.height;
        const sx = colIndex * fw;
        const sy = 0;
        const drawW = fw * SPRITE_SCALE;
        const drawH = fh * SPRITE_SCALE;
        const finalDrawH = drawH * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - drawH;
        push(); noSmooth();
        if (facing === 'left') image(sheet, drawX + drawW, drawY, -drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        else image(sheet, drawX, drawY, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        pop();
        return;
      }
      if (spritesheetWalk) {
        const fw = spritesheetWalk.width / cols;
        const fh = spritesheetWalk.height;
        const sx = colIndex * fw;
        const sy = 0;
        const drawW = fw * SPRITE_SCALE;
        const drawH = fh * SPRITE_SCALE;
        const finalDrawH = drawH * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - drawH;
        push(); noSmooth();
        if (facing === 'left') image(spritesheetWalk, drawX + drawW, drawY, -drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        else image(spritesheetWalk, drawX, drawY, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        pop();
        return;
      }
    } else if (action === 'run') {
      const frameImgRun = (runFrames[dir] && runFrames[dir][colIndex]) ? runFrames[dir][colIndex] : null;
      if (frameImgRun) {
        const fw = frameImgRun.width;
        const fh = frameImgRun.height;
        const drawW = fw * SPRITE_SCALE;
        const drawH = fh * SPRITE_SCALE;
        const finalDrawH = drawH * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - drawH;
        push(); noSmooth(); image(frameImgRun, drawX, drawY, drawW, finalDrawH, 0, 0, fw, fh * clipFactor); pop();
        return;
      }
      const dirSheetRun = runSheets[dir] || null;
      if (dirSheetRun) {
        const sheet = dirSheetRun;
        const fw = sheet.width / cols;
        const fh = sheet.height;
        const sx = colIndex * fw;
        const sy = 0;
        const drawW = fw * SPRITE_SCALE;
        const drawH = fh * SPRITE_SCALE;
        const finalDrawH = drawH * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - drawH;
        push(); noSmooth();
        if (facing === 'left') image(sheet, drawX + drawW, drawY, -drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        else image(sheet, drawX, drawY, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        pop();
        return;
      }
      if (spritesheetRun) {
        const fw = spritesheetRun.width / cols;
        const fh = spritesheetRun.height;
        const sx = colIndex * fw;
        const sy = 0;
        const drawW = fw * SPRITE_SCALE;
        const drawH = fh * SPRITE_SCALE;
        const finalDrawH = drawH * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - drawH;
        push(); noSmooth();
        if (facing === 'left') image(spritesheetRun, drawX + drawW, drawY, -drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        else image(spritesheetRun, drawX, drawY, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
        pop();
        return;
      }
    }
  }
  const frameImg = (idleFrames[dir] && idleFrames[dir][colIndex]) ? idleFrames[dir][colIndex] : null;
  if (frameImg) {
    const fw = frameImg.width;
    const fh = frameImg.height;
    const drawW = fw * SPRITE_SCALE;
    const drawH = fh * SPRITE_SCALE;
    const finalDrawH = drawH * clipFactor;
    const drawX = destX + (cellSize / 2) - (drawW / 2);
    const drawY = destY + cellSize - drawH;
    push(); noSmooth(); image(frameImg, drawX, drawY, drawW, finalDrawH, 0, 0, fw, fh * clipFactor); pop();
    return;
  }
  const dirSheet = idleSheets[dir] || null;
  if (dirSheet) {
    const sheet = dirSheet;
    const fw = sheet.width / cols;
    const fh = sheet.height;
    const sx = colIndex * fw;
    const sy = 0;
    const drawW = fw * SPRITE_SCALE;
    const drawH = fh * SPRITE_SCALE;
    const finalDrawH = drawH * clipFactor;
    const drawX = destX + (cellSize / 2) - (drawW / 2);
    const drawY = destY + cellSize - drawH;
    push(); noSmooth();
    if (facing === 'left') image(sheet, drawX + drawW, drawY, -drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
    else image(sheet, drawX, drawY, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
    pop();
    return;
  }
  if (spritesheetIdle) {
    const rows = IDLE_SHEET_ROWS;
    const fw = spritesheetIdle.width / cols;
    const fh = spritesheetIdle.height / rows;
    let rowIndex = 0;
    let flip = false;
    switch (dir) {
      case 'S': rowIndex = 0; break;
      case 'SW': rowIndex = 1; break;
      case 'W': rowIndex = 2; break;
      case 'NW': rowIndex = 3; break;
      case 'N': rowIndex = 4; break;
      case 'SE': rowIndex = 1; flip = true; break;
      case 'E': rowIndex = 2; flip = true; break;
      case 'NE': rowIndex = 3; flip = true; break;
      default: rowIndex = 0; break;
    }
    if (dir.includes('W')) facing = 'left';
    else if (dir.includes('E')) facing = 'right';
    const sx = colIndex * fw;
    const sy = rowIndex * fh;
    const drawW = fw * SPRITE_SCALE;
    const drawH = fh * SPRITE_SCALE;
    const finalDrawH = drawH * clipFactor;
    const drawX = destX + (cellSize / 2) - (drawW / 2);
    const drawY = destY + cellSize - drawH;
    push(); noSmooth();
    if (flip || facing === 'left') image(spritesheetIdle, drawX + drawW, drawY, -drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
    else image(spritesheetIdle, drawX, drawY, drawW, finalDrawH, sx, sy, fw, fh * clipFactor);
    pop();
    return;
  }
  push();
  noStroke();
  fill(COLORS.player);
  rect(destX, destY, cellSize, cellSize);
  pop();
}

function findFloodStart() {
  if (!logicalW || !logicalH) return -1;
  const candidates = [];
  if (playerPosition && typeof playerPosition.x === 'number' && typeof playerPosition.y === 'number') {
    candidates.push({ x: Math.round(playerPosition.x), y: Math.round(playerPosition.y) });
  }
  candidates.push({ x: Math.floor(logicalW / 2), y: Math.floor(logicalH / 2) });
  for (const c of candidates) {
    if (!c) continue;
    const { x, y } = c;
    if (x < 0 || x >= logicalW || y < 0 || y >= logicalH) continue;
    const state = getTileState(x, y);
    if (!isSolid(state)) {
      return y * logicalW + x;
    }
  }
  for (let idx = 0; idx < logicalW * logicalH; idx++) {
    const x = idx % logicalW;
    const y = Math.floor(idx / logicalW);
    const state = getTileState(x, y);
    if (!isSolid(state)) return idx;
  }
  return -1;
}

function neighbors(x, y) {
  const out = [];
  if (x > 0) out.push({ x: x - 1, y });
  if (x < logicalW - 1) out.push({ x: x + 1, y });
  if (y > 0) out.push({ x, y: y - 1 });
  if (y < logicalH - 1) out.push({ x, y: y + 1 });
  return out;
}

function findNextStep(startX, startY, targetX, targetY, maxDist = 12, maxNodes = 250) {
    if (startX === targetX && startY === targetY) return null;
    
    const dist = Math.hypot(startX - targetX, startY - targetY);
    if (dist > maxDist) return null; 

    const q = [{ x: targetX, y: targetY }];
    const cameFrom = new Map();
    const key = (x, y) => `${x},${y}`;
    cameFrom.set(key(targetX, targetY), null);
    
    let head = 0;
    while (head < q.length) {
        const curr = q[head++];
        
        // Check if we reached a neighbor of start
        if (Math.abs(curr.x - startX) + Math.abs(curr.y - startY) === 1) {
            return { x: curr.x, y: curr.y };
        }

        const nexts = neighbors(curr.x, curr.y);
        for (const n of nexts) {
            const k = key(n.x, n.y);
            if (!cameFrom.has(k)) {
                const ts = getTileState(n.x, n.y);
                const isWater = ts === TILE_TYPES.RIVER;
                const isObstacle = decorativeObstacleTiles.has(n.y * logicalW + n.x);
                
                if (!isSolid(ts) && !isWater && !isObstacle) {
                    cameFrom.set(k, curr);
                    q.push(n);
                }
            }
        }
        if (q.length > maxNodes) break; 
    }
    return null;
}


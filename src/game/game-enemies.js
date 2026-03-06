// game-enemies.js — Enemy creation, AI, projectiles, and VFX
// Extracted from 4-Game.js

// Cardinal directions used by enemy wander and fallback movement AI
const CARDINAL_DIRECTIONS = [
  { dx:  0, dy:  1, dir: 'S' },
  { dx:  0, dy: -1, dir: 'N' },
  { dx:  1, dy:  0, dir: 'E' },
  { dx: -1, dy:  0, dir: 'W' },
];

// Death splat type per enemy — 'acid' for ranged, 'egg' for others
const DEATH_SPLAT_TYPE = { mantis: 'acid', maggot: 'egg', beetle: 'egg' };

// Damage-text drift velocities (tiles/frame-normalised)
const DAMAGE_TEXT_DRIFT_VEL = 0.02;
const DAMAGE_TEXT_RISE_VEL  = 0.05;

/**
 * Returns true when `tileState` is passable (not solid and not river).
 * Used by enemy wander and pathfinding fallbacks.
 */
function isWalkableTile(tileState) {
  return !isSolid(tileState) && tileState !== TILE_TYPES.RIVER;
}

/**
 * Maps a cardinal/diagonal direction string to the sprite sheet row index.
 * Beetle uses S=0, W=1, E=2, N=3.
 * Mantis/Maggot use S=0, E=1, W=2, N=3.
 */
function getDirectionSpriteRow_NSEW(dir) {
  if (dir === 'S') return 0;
  if (dir === 'W') return 1;
  if (dir === 'E') return 2;
  return 3; // N
}
function getDirectionSpriteRow_SEWN(dir) {
  if (dir === 'S') return 0;
  if (dir === 'E') return 1;
  if (dir === 'W') return 2;
  return 3; // N
}

/**
 * Pushes the player `dist` tiles away from direction (dx, dy).
 * Tries the full distance first; if blocked, tries again with `fallbackDist` (optional).
 * @returns {boolean} true if position was successfully updated
 */
function _knockbackPlayer(dx, dy, dist, fallbackDist) {
  const mag = Math.hypot(dx, dy) || 1;
  const nx = Math.round(playerPosition.x + (dx / mag) * dist);
  const ny = Math.round(playerPosition.y + (dy / mag) * dist);
  if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH && !isSolid(getTileState(nx, ny))) {
    playerPosition.x = nx;
    playerPosition.y = ny;
    return true;
  }
  if (fallbackDist !== undefined) {
    const fx = Math.round(playerPosition.x + (dx / mag) * fallbackDist);
    const fy = Math.round(playerPosition.y + (dy / mag) * fallbackDist);
    if (fx >= 0 && fx < logicalW && fy >= 0 && fy < logicalH && !isSolid(getTileState(fx, fy))) {
      playerPosition.x = fx;
      playerPosition.y = fy;
      return true;
    }
  }
  return false;
}

/**
 * Triggers panic mode when the enemy's health drops to 1.
 * Clears isPanicking once the panic timer expires.
 */
function _updateEnemyPanic(enemy, panicDurationMs, label) {
  if (enemy.health === 1 && !enemy.isPanicking && enemy.panicTimer <= 0) {
    enemy.isPanicking = true;
    enemy.panicTimer  = panicDurationMs;
    verboseLog(`[game] ${label} is panicking!`);
  }
  if (enemy.panicTimer <= 0) enemy.isPanicking = false;
}

// --- Shared Combat Constants ---
const FRAME_TIME_MS           = 16.67; // nominal ms per frame at 60 fps; used to normalize dt-based movement
const STANDARD_IFRAMES_MS     = 600;   // invincibility window after most hits
const STANDARD_KNOCKBACK      = 0.8;   // tiles pushed on a regular hit
const STANDARD_DAMAGE         = 1;     // HP lost per hit (regular enemies)

// --- Beetle (Boss) Constants ---
const BEETLE_BASE_HP          = 15;    // starting HP at level 1
const BEETLE_HP_PER_LEVEL     = 5;     // bonus HP added per level above 1
const BEETLE_TELEPORT_DIST    = 40;    // tile distance at which the stuck-teleport logic activates
const BEETLE_STUCK_FAR_MS     = 5000;  // ms before teleporting when too far away
const BEETLE_TELEPORT_RADIUS  = 15;    // tile radius for the teleport landing spot
const BEETLE_STUCK_DELTA      = 0.01;  // minimum dist change per frame to count as "not stuck"
const BEETLE_STUCK_NEAR_MS    = 3000;  // ms before nudging when stuck nearby
const BEETLE_STUCK_NUDGE      = 2;     // tiles nudged in a random direction when stuck
const BEETLE_MELEE_RANGE      = 1.4;   // tile distance at which beetle starts an attack
const BEETLE_DIRECT_RANGE     = 8;     // within this range beetle tries straight-line movement
const BEETLE_CLOSE_RANGE      = 6;     // threshold for switching to faster chase speed
const BEETLE_SPEED_CLOSE      = 0.08;  // chase speed (tiles/frame) when near player
const BEETLE_SPEED_FAR        = 0.06;  // chase speed (tiles/frame) when farther away; also lunge speed
const BEETLE_PATHFIND_LIMIT   = 40;    // max nodes for beetle's pathfinding BFS
const BEETLE_LUNGE_FRAMES     = 4;     // attack frames during which beetle lunges forward
const BEETLE_ATTACK_ANIM_MS   = 100;   // ms per attack animation frame
const BEETLE_ATTACK_FRAMES    = 6;     // total frames in the attack animation
const BEETLE_ATTACK_DAMAGE_FRAME = 4;  // frame index on which the hit is checked
const BEETLE_HIT_RANGE        = 1.8;   // tile radius for the melee hit check
const BEETLE_IFRAMES_MS       = 800;   // longer i-frame window after boss hit
const BEETLE_SHAKE_TIMER      = 400;   // screen-shake duration (ms) after boss hit
const BEETLE_SHAKE_AMOUNT     = 20;    // screen-shake intensity after boss hit
const BEETLE_KNOCKBACK        = 1.5;   // tiles pushed on a boss hit
const BEETLE_KNOCKBACK_FALLBACK = 0.5; // shorter knockback used if primary target is blocked
const BEETLE_ATTACK_COOLDOWN_MS = 1200;// ms between beetle melee attacks
const BEETLE_MOVE_ANIM_MS     = 150;   // ms per walk animation frame
const BEETLE_SPRITE_FW        = 32;    // source frame width in the beetle spritesheet
const BEETLE_SPRITE_FH        = 32;    // source frame height in the beetle spritesheet
const BEETLE_DRAW_SIZE        = 80;    // on-screen size (px) for the boss sprite
const BEETLE_HEALTH_BAR_W     = 60;    // px width of the beetle health bar
const BEETLE_HEALTH_BAR_H     = 6;     // px height of the beetle health bar

// --- Mantis Constants ---
const MANTIS_BASE_HP          = 3;
const MANTIS_ATTACK_ANIM_MS   = 100;   // ms per attack animation frame
const MANTIS_ATTACK_FRAMES    = 7;     // total frames in the attack animation
const MANTIS_ATTACK_DAMAGE_FRAME = 4;  // frame on which the hit is checked
const MANTIS_HIT_RANGE        = 1.5;   // tile radius for melee hit check
const MANTIS_KNOCKBACK        = 0.8;   // tiles pushed on mantis hit
const MANTIS_ATTACK_COOLDOWN_MS = 1500;
const MANTIS_PANIC_DURATION_MS  = 4000;// ms mantis spends fleeing when at 1 HP
const MANTIS_ANIM_MS          = 200;   // ms per walk animation frame
const MANTIS_RENDER_LERP      = 0.15;  // lerp factor for smooth visual position
const MANTIS_LERP_THRESHOLD   = 0.01;  // snap to tile below this render distance
const MANTIS_AGGRO_RANGE      = 8;     // tile radius in which mantis chases player
const MANTIS_ATTACK_RANGE     = 1.5;   // tile distance at which mantis triggers attack
const MANTIS_AGGRO_MOVE_MS    = 400;   // ms between steps when chasing
const MANTIS_WANDER_PROB      = 0.02;  // per-frame probability of taking a wander step
const MANTIS_WANDER_MIN_MS    = 1000;  // minimum pause between wander steps
const MANTIS_WANDER_MAX_MS    = 2000;  // additional random pause between wander steps

// --- Maggot Constants ---
const MAGGOT_BASE_HP          = 2;
const MAGGOT_ATTACK_ANIM_MS   = 120;   // ms per spit animation frame
const MAGGOT_ATTACK_FRAMES    = 7;
const MAGGOT_PROJ_SPAWN_FRAME = 4;     // frame on which the acid blob is fired
const MAGGOT_ATTACK_COOLDOWN_MS = 2000;
const MAGGOT_PANIC_DURATION_MS  = 4000;
const MAGGOT_ANIM_MS          = 250;   // ms per walk animation frame
const MAGGOT_RENDER_LERP      = 0.1;
const MAGGOT_LERP_THRESHOLD   = 0.01;  // snap to tile below this render distance
const MAGGOT_ATTACK_RANGE     = 6;     // tile distance at which maggot fires
const MAGGOT_NOTICE_RANGE     = 10;    // tile distance at which maggot starts closing in
const MAGGOT_MOVE_MS          = 600;   // ms between steps (both aggro and panic)
const MAGGOT_WANDER_PROB      = 0.01;
const MAGGOT_WANDER_MIN_MS    = 1500;
const MAGGOT_WANDER_MAX_MS    = 3000;

// --- Acid Blob (Projectile) Constants ---
const ACID_BLOB_SPEED         = 0.15;  // tiles per frame at 60 fps
const ACID_BLOB_MAX_DIST      = 10;    // tiles before the blob expires
const ACID_BLOB_ANIM_MS       = 80;    // ms per animation frame
const ACID_BLOB_ANIM_FRAMES   = 7;
const ACID_BLOB_ANIM_ROWS     = 4;
const ACID_BLOB_HIT_RADIUS    = 0.6;   // tile radius for player hit check
const ACID_BLOB_KNOCKBACK     = 0.5;   // tiles pushed on projectile hit

// --- VFX Constants ---
const DAMAGE_TEXT_LIFE_MS     = 1000;
const DAMAGE_TEXT_SIZE        = 20;
const SPLAT_LIFE_MS           = 1500;
const RIPPLE_LIFE_MS          = 800;
const RIPPLE_INITIAL_SIZE     = 5;
const RIPPLE_GROWTH_SPEED     = 0.8;   // pixels grown per frame
const RIPPLE_ALPHA            = 150;
const FIREFLY_MIN_LIFE_MS     = 4000;
const FIREFLY_MAX_LIFE_MS     = 8000;
const FIREFLY_MAX_VEL         = 0.02;  // tiles/frame drift speed
const FIREFLY_VEL_DRIFT       = 0.002; // per-frame random velocity change
const FIREFLY_PULSE_SPEED     = 600;   // ms per alpha pulse cycle
const FIREFLY_LIGHT_RADIUS    = 40;    // px radius for the WeatherSystem light source
const FIREFLY_INTENSITY       = 0.15;  // light intensity fed to WeatherSystem.drawOverlay

// Spawns an enemy of the given type at (x, y) and adds it to the enemies array.
function spawnEnemy(type, x, y) {
  if (type === 'mantis') {
    enemies.push(createMantis(x, y));
  } else if (type === 'maggot') {
    enemies.push(createMaggot(x, y));
  } else if (type === 'beetle') {
    enemies.push(createBeetle(x, y));
  }
}

// Creates the boss Beetle enemy object. HP and Damage scale with currentLevel.
function createBeetle(startX, startY) {
  const hpBonus = (playerLevel - 1) * BEETLE_HP_PER_LEVEL;
  const totalHP = BEETLE_BASE_HP + hpBonus;

  return {
    type: 'beetle',
    x: startX,
    y: startY,
    health: totalHP,
    maxHealth: totalHP,
    xpReward: 500,
    renderX: startX,
    renderY: startY,
    direction: 'S',
    moving: false,
    animFrame: 0,
    animTimer: 0,
    attacking: false,
    attackFrame: 0,
    attackTimer: 0,
    aggro: true, // always aggressive — hunts the player from spawn
    speed: 0.02,
    hurtTimer: 0,
    attackCooldown: 0,
    stuckTimer: 0,
    lastDist: 0,

    update: function() {
      const dt = gameDelta;
      const targetX = playerPosition.x;
      const targetY = playerPosition.y;
      const d = dist(this.x, this.y, targetX, targetY);

      // --- Stuck / Long-Range Teleport Fallback ---
      if (d > BEETLE_TELEPORT_DIST) {
          this.stuckTimer += dt;
          if (this.stuckTimer > BEETLE_STUCK_FAR_MS) {
              const angle = Math.random() * TWO_PI;
              const tx = constrain(targetX + Math.cos(angle) * BEETLE_TELEPORT_RADIUS, 1, logicalW - 2);
              const ty = constrain(targetY + Math.sin(angle) * BEETLE_TELEPORT_RADIUS, 1, logicalH - 2);
              if (!isSolid(getTileState(Math.round(tx), Math.round(ty)))) {
                  this.x = tx;
                  this.y = ty;
                  this.renderX = tx;
                  this.renderY = ty;
                  this.stuckTimer = 0;
                  verboseLog('[game] Boss Beetle teleported closer to player');
              }
          }
      } else if (Math.abs(d - (this.lastDist || 0)) < BEETLE_STUCK_DELTA) {
          this.stuckTimer += dt;
          if (this.stuckTimer > BEETLE_STUCK_NEAR_MS) {
              const angle = Math.random() * TWO_PI;
              this.x += Math.cos(angle) * BEETLE_STUCK_NUDGE;
              this.y += Math.sin(angle) * BEETLE_STUCK_NUDGE;
              this.renderX = this.x;
              this.renderY = this.y;
              this.stuckTimer = 0;
          }
      } else {
          this.stuckTimer = 0;
      }
      this.lastDist = d;

      this.moving = false;
      if (this.attackCooldown > 0) this.attackCooldown -= dt;

      if (this.aggro && !this.attacking) {
        if (d < BEETLE_MELEE_RANGE && this.attackCooldown <= 0) {
          this.attacking = true;
          this.attackFrame = 0;
          this.attackTimer = 0;
        } else {
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          const canMoveDirect = d < BEETLE_DIRECT_RANGE
            && !isSolid(getTileState(Math.round(this.x + dx * 0.5), Math.round(this.y + dy * 0.5)));

          const moveSpeed = (d < BEETLE_CLOSE_RANGE) ? BEETLE_SPEED_CLOSE : BEETLE_SPEED_FAR;

          if (canMoveDirect) {
            const mag = Math.hypot(dx, dy) || 1;
            this.x += (dx / mag) * moveSpeed;
            this.y += (dy / mag) * moveSpeed;
            this.moving = true;
          } else {
            const step = findNextStep(Math.round(this.x), Math.round(this.y), Math.round(targetX), Math.round(targetY), BEETLE_PATHFIND_LIMIT);
            if (step) {
                const stepDX = step.x - this.x;
                const stepDY = step.y - this.y;
                const mag = Math.hypot(stepDX, stepDY) || 1;
                this.x += (stepDX / mag) * moveSpeed;
                this.y += (stepDY / mag) * moveSpeed;
                this.moving = true;
            } else {
                // Long-range fallback: walk toward player, slide along walls if blocked
                const mag = Math.hypot(dx, dy) || 1;
                const nextX = this.x + (dx / mag) * moveSpeed;
                const nextY = this.y + (dy / mag) * moveSpeed;

                if (!isSolid(getTileState(Math.round(nextX), Math.round(nextY)))) {
                    this.x = nextX;
                    this.y = nextY;
                    this.moving = true;
                } else if (!isSolid(getTileState(Math.round(nextX), Math.round(this.y)))) {
                    this.x = nextX;
                    this.moving = true;
                } else if (!isSolid(getTileState(Math.round(this.x), Math.round(nextY)))) {
                    this.y = nextY;
                    this.moving = true;
                }
            }
          }
          if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'E' : 'W';
          } else {
            this.direction = dy > 0 ? 'S' : 'N';
          }
        }
      }

      if (this.attacking) {
        this.attackTimer += dt;

        // Lunge mechanic: beetle surges toward player during the opening frames
        if (this.attackFrame < BEETLE_LUNGE_FRAMES) {
            const lx = targetX - this.x;
            const ly = targetY - this.y;
            const lMag = Math.hypot(lx, ly) || 1;
            this.x += (lx / lMag) * BEETLE_SPEED_FAR;
            this.y += (ly / lMag) * BEETLE_SPEED_FAR;
        }

        if (this.attackTimer > BEETLE_ATTACK_ANIM_MS) {
          this.attackTimer = 0;
          this.attackFrame++;

          if (this.attackFrame === BEETLE_ATTACK_DAMAGE_FRAME) {
            const hitDist = dist(this.renderX, this.renderY, playerPosition.x, playerPosition.y);
            if (hitDist < BEETLE_HIT_RANGE && playerHurtTimer <= 0) {
                let actualDmg = STANDARD_DAMAGE + Math.floor(playerLevel / 3);
                if (typeof equipment !== 'undefined' && equipment.armor) actualDmg = Math.max(1, actualDmg - equipment.armor.defense);
                playerHealth = Math.max(0, playerHealth - actualDmg);
                spawnDamageText(`-${actualDmg}`, playerPosition.x, playerPosition.y, [255, 0, 0]);
                playerHurtTimer = BEETLE_IFRAMES_MS;
                screenShakeTimer = BEETLE_SHAKE_TIMER;
                screenShakeAmount = BEETLE_SHAKE_AMOUNT;

                // Knockback: snap player to nearest valid tile
                _knockbackPlayer(
                  playerPosition.x - this.x,
                  playerPosition.y - this.y,
                  BEETLE_KNOCKBACK,
                  BEETLE_KNOCKBACK_FALLBACK
                );
            }
          }

          if (this.attackFrame >= BEETLE_ATTACK_FRAMES) {
            this.attacking = false;
            this.attackFrame = 0;
            this.attackCooldown = BEETLE_ATTACK_COOLDOWN_MS;
          }
        }
      }

      // Beetle is large — always render at actual position to prevent mid-move invisibility
      this.renderX = this.x;
      this.renderY = this.y;

      if (this.hurtTimer > 0) this.hurtTimer -= dt;
    },

    draw: function() {
      let sprite = beetleMoveSprite;
      let frameCount = 4;
      let frame = 0;
      let row = 0;

      if (this.attacking) {
        sprite = beetleAttackSprite || beetleMoveSprite;
        frameCount = sprite === beetleAttackSprite ? BEETLE_ATTACK_FRAMES : 4;
        frame = Math.min(this.attackFrame, frameCount - 1);
      } else {
        if (this.moving) frame = Math.floor(millis() / BEETLE_MOVE_ANIM_MS) % frameCount;
      }

      row = getDirectionSpriteRow_NSEW(this.direction);

      if (!sprite) return;

      const sx = frame * BEETLE_SPRITE_FW;
      const sy = row  * BEETLE_SPRITE_FH;

      const destX = this.renderX * cellSize;
      const destY = this.renderY * cellSize;
      const drawX = destX + (cellSize / 2) - (BEETLE_DRAW_SIZE / 2);
      const drawY = destY + cellSize - BEETLE_DRAW_SIZE; // anchor bottom

      push();
      if (this.hurtTimer > 0) tint(255, 100, 100);
      image(sprite, drawX, drawY, BEETLE_DRAW_SIZE, BEETLE_DRAW_SIZE, sx, sy, BEETLE_SPRITE_FW, BEETLE_SPRITE_FH);
      noTint();
      pop();

      // Health bar
      noStroke();
      const barX = destX + (cellSize - BEETLE_HEALTH_BAR_W) / 2;
      const barY = drawY - 8;
      fill(0, 100);
      rect(barX, barY, BEETLE_HEALTH_BAR_W, BEETLE_HEALTH_BAR_H);
      fill(255, 0, 0);
      rect(barX, barY, BEETLE_HEALTH_BAR_W * (this.health / this.maxHealth), BEETLE_HEALTH_BAR_H);
    }
  };
}

// Creates a Mantis enemy: melee attacker that panics and charges when at 1 HP.
function createMantis(startX, startY) {
  const bonusHP = Math.floor(playerLevel / 2);
  const totalHP = MANTIS_BASE_HP + bonusHP;
  return {
    type: 'mantis',
    x: startX,
    y: startY,
    health: totalHP,
    maxHealth: totalHP,
    xpReward: 30 + (playerLevel * 2),
    hurtTimer: 0,
    panicTimer: 0,
    isPanicking: false,
    renderX: startX,
    renderY: startY,
    direction: 'S',
    moving: false,
    animFrame: 0,
    animTimer: 0,
    moveTimer: 0,
    attacking: false,
    attackFrame: 0,
    attackTimer: 0,
    attackCooldown: 0,
    hasDealtDamage: false,

    update: function() {
      const dt = gameDelta;

      // --- Attack State ---
      if (this.attacking) {
         this.attackTimer += dt;
         if (this.attackTimer > MANTIS_ATTACK_ANIM_MS) {
             this.attackTimer = 0;
             this.attackFrame++;

             if (this.attackFrame === MANTIS_ATTACK_DAMAGE_FRAME && !this.hasDealtDamage) {
                 if (playerPosition) {
                     const d = Math.hypot(playerPosition.x - this.x, playerPosition.y - this.y);
                     if (d < MANTIS_HIT_RANGE && playerHurtTimer <= 0) {
                         let actualDmg = STANDARD_DAMAGE;
                         if (typeof equipment !== 'undefined' && equipment.armor) actualDmg = Math.max(1, actualDmg - equipment.armor.defense);
                         playerHealth = Math.max(0, playerHealth - actualDmg);
                         this.hasDealtDamage = true;
                         playerHurtTimer = STANDARD_IFRAMES_MS;
                         spawnDamageText(`-${actualDmg}`, playerPosition.x, playerPosition.y, [255, 0, 0]);

                         _knockbackPlayer(
                           playerPosition.x - this.x,
                           playerPosition.y - this.y,
                           MANTIS_KNOCKBACK
                         );
                     }
                 }
             }

             if (this.attackFrame >= MANTIS_ATTACK_FRAMES) {
                 this.attacking = false;
                 this.attackCooldown = MANTIS_ATTACK_COOLDOWN_MS;
                 this.attackFrame = 0;
             }
         }
         return; // don't move while attacking
      }

      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.hurtTimer > 0)      this.hurtTimer      -= dt;
      if (this.panicTimer > 0)     this.panicTimer      -= dt;

      // Panic triggers when health is critical; lasts a fixed duration
      _updateEnemyPanic(this, MANTIS_PANIC_DURATION_MS, 'Mantis');

      // --- Smooth render interpolation ---
      this.animTimer += dt;
      if (this.animTimer > MANTIS_ANIM_MS) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }

      if (Math.abs(this.renderX - this.x) > MANTIS_LERP_THRESHOLD) this.renderX = lerp(this.renderX, this.x, MANTIS_RENDER_LERP);
      else this.renderX = this.x;
      if (Math.abs(this.renderY - this.y) > MANTIS_LERP_THRESHOLD) this.renderY = lerp(this.renderY, this.y, MANTIS_RENDER_LERP);
      else this.renderY = this.y;

      if (this.moveTimer > 0) {
        this.moveTimer -= dt;
        return;
      }

      // --- Aggro Logic ---
      let targetX = null, targetY = null, isAggro = false;

      if (playerPosition) {
          const d = Math.hypot(playerPosition.x - this.x, playerPosition.y - this.y);

          if (this.isPanicking) {
              // Flee in the opposite direction from the player
              isAggro = true;
              targetX = this.x + (this.x - playerPosition.x);
              targetY = this.y + (this.y - playerPosition.y);
          } else {
              if (d < MANTIS_ATTACK_RANGE && this.attackCooldown <= 0) {
                  this.attacking = true;
                  this.attackFrame = 0;
                  this.attackTimer = 0;
                  this.hasDealtDamage = false;
                  const dx = playerPosition.x - this.x;
                  const dy = playerPosition.y - this.y;
                  if (Math.abs(dx) > Math.abs(dy)) {
                    this.direction = dx > 0 ? 'E' : 'W';
                  } else {
                    this.direction = dy > 0 ? 'S' : 'N';
                  }
                  return;
              }

              if (d < MANTIS_AGGRO_RANGE) {
                 isAggro = true;
                 targetX = playerPosition.x;
                 targetY = playerPosition.y;
              }
          }
      }

      if (isAggro) {
          const nextStep = findNextStep(this.x, this.y, targetX, targetY);

          if (nextStep) {
              const dx = nextStep.x - this.x;
              const dy = nextStep.y - this.y;
              if      (dx > 0) this.direction = 'E';
              else if (dx < 0) this.direction = 'W';
              else if (dy > 0) this.direction = 'S';
              else if (dy < 0) this.direction = 'N';
              this.x = nextStep.x;
              this.y = nextStep.y;
              this.moveTimer = MANTIS_AGGRO_MOVE_MS;
              return;
          }

          // Fallback: cardinal step toward target, try secondary axis if blocked
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          let moveX = 0, moveY = 0, newDir = this.direction;

          if (Math.abs(dx) > Math.abs(dy)) {
              if (dx > 0) { moveX =  1; newDir = 'E'; }
              else        { moveX = -1; newDir = 'W'; }
          } else {
              if (dy > 0) { moveY =  1; newDir = 'S'; }
              else        { moveY = -1; newDir = 'N'; }
          }

          let nx = this.x + moveX;
          let ny = this.y + moveY;

          if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH && isWalkableTile(getTileState(nx, ny))) {
              this.x = nx;
              this.y = ny;
              this.direction = newDir;
              this.moveTimer = MANTIS_AGGRO_MOVE_MS;
              return;
          }

          // Try secondary axis
          moveX = 0;
          moveY = 0;
          if (Math.abs(dx) > Math.abs(dy)) {
              if (dy > 0)      { moveY =  1; newDir = 'S'; }
              else if (dy < 0) { moveY = -1; newDir = 'N'; }
          } else {
              if (dx > 0)      { moveX =  1; newDir = 'E'; }
              else if (dx < 0) { moveX = -1; newDir = 'W'; }
          }
          if (moveX !== 0 || moveY !== 0) {
              nx = this.x + moveX;
              ny = this.y + moveY;
              if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH && isWalkableTile(getTileState(nx, ny))) {
                  this.x = nx;
                  this.y = ny;
                  this.direction = newDir;
                  this.moveTimer = MANTIS_AGGRO_MOVE_MS;
              }
          }
          return;
      }

      // --- Idle Wander ---
      if (Math.random() < MANTIS_WANDER_PROB) {
        const choice = CARDINAL_DIRECTIONS[Math.floor(Math.random() * CARDINAL_DIRECTIONS.length)];
        const nx = this.x + choice.dx;
        const ny = this.y + choice.dy;
        if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH) {
            if (isWalkableTile(getTileState(nx, ny))) {
                this.x = nx;
                this.y = ny;
                this.direction = choice.dir;
                this.moveTimer = MANTIS_WANDER_MIN_MS + Math.random() * MANTIS_WANDER_MAX_MS;
            }
        }
      }
    },

    draw: function() {
        let sprite = mantisMoveSprite;
        let frame = this.animFrame;
        let cols = 4;

        if (this.attacking && mantisAttackSprite) {
            sprite = mantisAttackSprite;
            frame = this.attackFrame;
            cols = MANTIS_ATTACK_FRAMES;
        }

        if (!sprite) return;

        const row = getDirectionSpriteRow_SEWN(this.direction);

        const fw = sprite.width / cols;
        const fh = sprite.height / 4;

        const destX = this.renderX * cellSize;
        const destY = this.renderY * cellSize;

        let tx = 0, ty = 0;
        if (this.attacking && this.attackFrame < 4) { tx = random(-2, 2); ty = random(-2, 2); }

        const drawH = cellSize * 1.2;
        const drawW = drawH * (fw / fh);
        const drawX = destX + (cellSize - drawW) / 2;
        const drawY = destY + (cellSize - drawH); // anchor bottom

        if (this.hurtTimer > 0) tint(255, 0, 0);
        image(sprite, drawX + tx, drawY + ty, drawW, drawH, frame * fw, row * fh, fw, fh);
        if (this.hurtTimer > 0) noTint();

        if (this.health < this.maxHealth) {
            const barW = cellSize * 0.8;
            const barX = destX + (cellSize - barW) / 2;
            const barY = drawY - 8;
            fill(0, 150);
            noStroke();
            rect(barX, barY, barW, 4);
            fill(255, 0, 0);
            rect(barX, barY, barW * (this.health / this.maxHealth), 4);
        }
    }
  };
}

// Creates a Maggot enemy: ranged spitter that fires acid blobs at the player.
function createMaggot(startX, startY) {
  const bonusHP = Math.floor(playerLevel / 3);
  const totalHP = MAGGOT_BASE_HP + bonusHP;
  return {
    type: 'maggot',
    x: startX,
    y: startY,
    health: totalHP,
    maxHealth: totalHP,
    xpReward: 20 + (playerLevel * 2),
    hurtTimer: 0,
    panicTimer: 0,
    isPanicking: false,
    renderX: startX,
    renderY: startY,
    direction: 'S',
    moving: false,
    animFrame: 0,
    animTimer: 0,
    moveTimer: 0,
    attacking: false,
    attackFrame: 0,
    attackTimer: 0,
    attackCooldown: 0,
    hasSpawnedProjectile: false,

    update: function() {
      const dt = gameDelta;

      // --- Attack (Spit) State ---
      if (this.attacking) {
         this.attackTimer += dt;
         if (this.attackTimer > MAGGOT_ATTACK_ANIM_MS) {
             this.attackTimer = 0;
             this.attackFrame++;

             if (this.attackFrame === MAGGOT_PROJ_SPAWN_FRAME && !this.hasSpawnedProjectile && playerPosition) {
                 spawnAcidBlob(this.x, this.y, playerPosition.x, playerPosition.y, this.direction);
                 this.hasSpawnedProjectile = true;
             }

             if (this.attackFrame >= MAGGOT_ATTACK_FRAMES) {
                 this.attacking = false;
                 this.attackCooldown = MAGGOT_ATTACK_COOLDOWN_MS;
                 this.attackFrame = 0;
             }
         }
         return; // don't move while spitting
      }

      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.hurtTimer > 0)      this.hurtTimer      -= dt;
      if (this.panicTimer > 0)     this.panicTimer      -= dt;

      _updateEnemyPanic(this, MAGGOT_PANIC_DURATION_MS, 'Maggot');

      // --- Smooth render interpolation ---
      this.animTimer += dt;
      if (this.animTimer > MAGGOT_ANIM_MS) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }

      if (Math.abs(this.renderX - this.x) > MAGGOT_LERP_THRESHOLD) this.renderX = lerp(this.renderX, this.x, MAGGOT_RENDER_LERP);
      else this.renderX = this.x;
      if (Math.abs(this.renderY - this.y) > MAGGOT_LERP_THRESHOLD) this.renderY = lerp(this.renderY, this.y, MAGGOT_RENDER_LERP);
      else this.renderY = this.y;

      if (this.moveTimer > 0) {
        this.moveTimer -= dt;
        return;
      }

      // --- Aggro Logic ---
      if (playerPosition) {
          const d = Math.hypot(playerPosition.x - this.x, playerPosition.y - this.y);

          if (this.isPanicking) {
              // Flee away from player using pathfinding
              const nextStep = findNextStep(this.x, this.y,
                  this.x + (this.x - playerPosition.x),
                  this.y + (this.y - playerPosition.y));
              if (nextStep) {
                  const dx = nextStep.x - this.x;
                  const dy = nextStep.y - this.y;
                  if      (dx > 0) this.direction = 'E';
                  else if (dx < 0) this.direction = 'W';
                  else if (dy > 0) this.direction = 'S';
                  else if (dy < 0) this.direction = 'N';
                  this.x = nextStep.x;
                  this.y = nextStep.y;
                  this.moveTimer = MAGGOT_MOVE_MS;
                  return;
              }
          } else {
              if (d < MAGGOT_ATTACK_RANGE && this.attackCooldown <= 0) {
                  this.attacking = true;
                  this.attackFrame = 0;
                  this.attackTimer = 0;
                  this.hasSpawnedProjectile = false;
                  return;
              }

              // Close in when noticed but outside attack range
              if (d >= MAGGOT_ATTACK_RANGE && d < MAGGOT_NOTICE_RANGE) {
                  const nextStep = findNextStep(this.x, this.y, playerPosition.x, playerPosition.y);
                  if (nextStep) {
                      const dx = nextStep.x - this.x;
                      const dy = nextStep.y - this.y;
                      if      (dx > 0) this.direction = 'E';
                      else if (dx < 0) this.direction = 'W';
                      else if (dy > 0) this.direction = 'S';
                      else if (dy < 0) this.direction = 'N';
                      this.x = nextStep.x;
                      this.y = nextStep.y;
                      this.moveTimer = MAGGOT_MOVE_MS;
                      return;
                  }
              }
          }
      }

      // --- Idle Wander ---
      if (Math.random() < MAGGOT_WANDER_PROB) {
        const choice = CARDINAL_DIRECTIONS[Math.floor(Math.random() * CARDINAL_DIRECTIONS.length)];
        const nx = this.x + choice.dx;
        const ny = this.y + choice.dy;
        if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH) {
            if (isWalkableTile(getTileState(nx, ny))) {
                this.x = nx;
                this.y = ny;
                this.direction = choice.dir;
                this.moveTimer = MAGGOT_WANDER_MIN_MS + Math.random() * MAGGOT_WANDER_MAX_MS;
            }
        }
      }
    },

    draw: function() {
        let sprite = maggotWalkSprite;
        let frame = this.animFrame;
        let cols = 4;

        if (this.attacking && maggotSpitSprite) {
            sprite = maggotSpitSprite;
            frame = this.attackFrame;
            cols = MAGGOT_ATTACK_FRAMES;
        }

        if (!sprite) return;

        const row = getDirectionSpriteRow_NSEW(this.direction);

        const fw = sprite.width / cols;
        const fh = sprite.height / 4;

        const destX = this.renderX * cellSize;
        const destY = this.renderY * cellSize;

        let tx = 0, ty = 0;
        if (this.attacking && this.attackFrame < 4) { tx = random(-2, 2); ty = random(-2, 2); }

        const drawH = cellSize * 1.0;
        const drawW = drawH * (fw / fh);
        const drawX = destX + (cellSize - drawW) / 2;
        const drawY = destY + (cellSize - drawH);

        if (this.hurtTimer > 0) tint(255, 0, 0);
        image(sprite, drawX + tx, drawY + ty, drawW, drawH, frame * fw, row * fh, fw, fh);
        if (this.hurtTimer > 0) noTint();

        if (this.health < this.maxHealth) {
            const barW = cellSize * 0.8;
            const barX = destX + (cellSize - barW) / 2;
            const barY = drawY - 8;
            fill(0, 150);
            noStroke();
            rect(barX, barY, barW, 4);
            fill(255, 0, 0);
            rect(barX, barY, barW * (this.health / this.maxHealth), 4);
        }
    }
  };
}



// Fires an acid blob from (startX, startY) toward (targetX, targetY).
function spawnAcidBlob(startX, startY, targetX, targetY, initialDir) {
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const vx = Math.cos(angle) * ACID_BLOB_SPEED;
    const vy = Math.sin(angle) * ACID_BLOB_SPEED;

    let projDir = initialDir;
    if (Math.abs(vx) > Math.abs(vy)) projDir = vx > 0 ? 'E' : 'W';
    else                              projDir = vy > 0 ? 'S' : 'N';

    projectiles.push({
        type: 'acid_blob',
        x: startX,
        y: startY,
        vx,
        vy,
        direction: projDir,
        animFrame: 0,
        animTimer: 0,
        distanceTraveled: 0,
        maxDistance: ACID_BLOB_MAX_DIST,

        update: function() {
            const dt = gameDelta;
            const step = dt / FRAME_TIME_MS;
            this.x += this.vx * step;
            this.y += this.vy * step;
            this.distanceTraveled += Math.hypot(this.vx, this.vy) * step;

            this.animTimer += dt;
            if (this.animTimer > ACID_BLOB_ANIM_MS) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % ACID_BLOB_ANIM_FRAMES;
            }

            if (playerPosition) {
                const d = Math.hypot(this.x - playerPosition.x, this.y - playerPosition.y);
                if (d < ACID_BLOB_HIT_RADIUS) {
                    if (playerHurtTimer <= 0) {
                         let actualDmg = STANDARD_DAMAGE;
                         if (typeof equipment !== 'undefined' && equipment.armor) actualDmg = Math.max(1, actualDmg - equipment.armor.defense);
                         playerHealth = Math.max(0, playerHealth - actualDmg);
                         spawnDamageText(`-${actualDmg}`, playerPosition.x, playerPosition.y, [255, 0, 0]);

                        _knockbackPlayer(this.vx, this.vy, ACID_BLOB_KNOCKBACK);
                    }
                    return true; // remove regardless of i-frames
                }
            }

            return this.distanceTraveled > this.maxDistance;
        },

        draw: function() {
            if (!acidBlobSprite) return;
            const row = getDirectionSpriteRow_NSEW(this.direction);

            const fw = acidBlobSprite.width  / ACID_BLOB_ANIM_FRAMES;
            const fh = acidBlobSprite.height / ACID_BLOB_ANIM_ROWS;
            const drawSize = cellSize * 0.8;
            image(acidBlobSprite,
                this.x * cellSize + (cellSize - drawSize) / 2,
                this.y * cellSize + (cellSize - drawSize) / 2,
                drawSize, drawSize,
                this.animFrame * fw, row * fh, fw, fh);
        }
    });
}

// Advances all active projectiles; removes ones that return true from update().
function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (projectiles[i].update()) projectiles.splice(i, 1);
    }
}

// Spawns a floating damage/pickup number that drifts upward and fades out.
function spawnDamageText(val, x, y, color = [255, 255, 255]) {
    vfx.push({
        type: 'text',
        text: val,
        x, y,
        vx: random(-DAMAGE_TEXT_DRIFT_VEL, DAMAGE_TEXT_DRIFT_VEL),
        vy: -DAMAGE_TEXT_RISE_VEL,
        alpha: 255,
        life: DAMAGE_TEXT_LIFE_MS,
        maxLife: DAMAGE_TEXT_LIFE_MS,
        color,
        update: function(dt) {
            const step = dt / FRAME_TIME_MS;
            this.x += this.vx * step;
            this.y += this.vy * step;
            this.life -= dt;
            this.alpha = (this.life / this.maxLife) * 255;
            return this.life <= 0;
        },
        draw: function() {
            push();
            textAlign(CENTER);
            fill(this.color[0], this.color[1], this.color[2], this.alpha);
            stroke(0, this.alpha);
            strokeWeight(2);
            gTextSize(DAMAGE_TEXT_SIZE);
            text(this.text, this.x * cellSize + cellSize / 2, this.y * cellSize);
            pop();
        }
    });
}

// Spawns an animated splat VFX sprite (acid or egg) at a tile position.
function spawnSplat(x, y, type = 'acid') {
    const sprite = type === 'egg' ? eggsplosionSprite : acidSplatSprite;
    if (!sprite) return;
    vfx.push({
        type: 'sprite',
        sprite,
        x, y,
        alpha: 255,
        life: SPLAT_LIFE_MS,
        maxLife: SPLAT_LIFE_MS,
        scale: random(0.6, 1.0),
        update: function(dt) {
            this.life -= dt;
            this.alpha = (this.life / this.maxLife) * 255;
            return this.life <= 0;
        },
        draw: function() {
            push();
            const drawSize = cellSize * this.scale;
            const px = this.x * cellSize + (cellSize - drawSize) / 2;
            const py = this.y * cellSize + (cellSize - drawSize) / 2;
            tint(255, this.alpha);
            image(this.sprite, px, py, drawSize, drawSize);
            noTint();
            pop();
        }
    });
}

// Spawns an expanding ellipse ripple VFX at a tile position (used for water steps).
function spawnRipple(x, y) {
    vfx.push({
        type: 'ripple',
        x, y,
        alpha: RIPPLE_ALPHA,
        life: RIPPLE_LIFE_MS,
        maxLife: RIPPLE_LIFE_MS,
        size: RIPPLE_INITIAL_SIZE,
        update: function(dt) {
            this.life -= dt;
            this.size += (dt / FRAME_TIME_MS) * RIPPLE_GROWTH_SPEED;
            this.alpha = (this.life / this.maxLife) * RIPPLE_ALPHA;
            return this.life <= 0;
        },
        draw: function() {
            push();
            noFill();
            stroke(255, this.alpha);
            strokeWeight(1.5);
            const px = this.x * cellSize + cellSize / 2;
            const py = this.y * cellSize + cellSize / 2;
            ellipse(px, py, this.size, this.size * 0.6); // perspective oval
            pop();
        }
    });
}

// Spawns a glowing firefly VFX that drifts randomly and pulses, providing a light source.
function spawnFirefly() {
    const camX = smoothCamX || 0;
    const camY = smoothCamY || 0;
    const spawnRX = (random(virtualW) - virtualW / 2) + camX;
    const spawnRY = (random(virtualH) - virtualH / 2) + camY;
    const life = random(FIREFLY_MIN_LIFE_MS, FIREFLY_MAX_LIFE_MS);

    vfx.push({
        type: 'firefly',
        x: spawnRX / cellSize,
        y: spawnRY / cellSize,
        vx: random(-FIREFLY_MAX_VEL, FIREFLY_MAX_VEL),
        vy: random(-FIREFLY_MAX_VEL, FIREFLY_MAX_VEL),
        alpha: 0,
        targetAlpha: random(100, 255),
        life,
        maxLife: life,
        phase: random(Math.PI * 2),
        update: function(dt) {
            this.life -= dt;
            const step = dt / FRAME_TIME_MS;
            this.x += this.vx * step;
            this.y += this.vy * step;
            this.vx += random(-FIREFLY_VEL_DRIFT, FIREFLY_VEL_DRIFT);
            this.vy += random(-FIREFLY_VEL_DRIFT, FIREFLY_VEL_DRIFT);
            this.alpha = map(Math.sin(millis() / FIREFLY_PULSE_SPEED + this.phase), -1, 1, 20, this.targetAlpha);
            return this.life <= 0;
        },
        draw: function() {
            const px = this.x * cellSize;
            const py = this.y * cellSize;
            noStroke();
            fill(200, 255, 100, this.alpha);
            circle(px, py, 2);
            fill(200, 255, 100, this.alpha * 0.2);
            circle(px, py, 6);
        },
        getLight: function() {
            return {
                worldX: this.x * cellSize,
                worldY: this.y * cellSize,
                radius: FIREFLY_LIGHT_RADIUS,
                color: [180, 255, 80],
                intensity: (this.alpha / 255) * FIREFLY_INTENSITY
            };
        }
    });
}

// Advances all active VFX; removes completed ones.
function updateVFX() {
    const dt = gameDelta;
    for (let i = vfx.length - 1; i >= 0; i--) {
        if (vfx[i].update(dt)) vfx.splice(i, 1);
    }
}
function updateEnemies() {
  const dt = gameDelta;

  if (!enemies) return;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.update) e.update();

    if (e.health <= 0) {
        if (e.xpReward) {
            playerXP += e.xpReward;
            spawnDamageText(`+${e.xpReward} XP`, e.x, e.y, [50, 200, 255]);
        }
        spawnSplat(e.x, e.y, DEATH_SPLAT_TYPE[e.type] ?? 'egg');
        enemies.splice(i, 1);
        continue;
    }

    // Beetle is immune to crush damage due to its large size
    if (e.type === 'beetle') continue;

    const tx = Math.floor(e.x + 0.5);
    const ty = Math.floor(e.y + 0.5);
    if (tx >= 0 && tx < logicalW && ty >= 0 && ty < logicalH) {
         const ts = getTileState(tx, ty);
         if (isSolid(ts)) {
             e.health = 0;
             spawnSplat(e.x, e.y, DEATH_SPLAT_TYPE[e.type] ?? 'egg');
             spawnDamageText(t('crush'), e.x, e.y, [150, 150, 150]);
             enemies.splice(i, 1);
         }
    }
  }
}

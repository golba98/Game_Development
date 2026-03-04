// game-enemies.js — Enemy creation, AI, projectiles, and VFX
// Extracted from 4-Game.js

function spawnEnemy(type, x, y) {
  if (type === 'mantis') {
    enemies.push(createMantis(x, y));
  } else if (type === 'maggot') {
    enemies.push(createMaggot(x, y));
  } else if (type === 'beetle') {
    enemies.push(createBeetle(x, y));
  }
}

function createBeetle(startX, startY) {
  // Scale health with currentLevel
  const hpBonus = (currentLevel - 1) * 5;
  const totalHP = 15 + hpBonus;
  
  return {
    type: 'beetle',
    x: startX,
    y: startY,
    health: totalHP,
    maxHealth: totalHP,
    renderX: startX,
    renderY: startY,
    direction: 'S',
    moving: false,
    animFrame: 0,
    animTimer: 0,
    attacking: false,
    attackFrame: 0,
    attackTimer: 0,
    aggro: true, // Always aggressive - hunts the player from spawn
    speed: 0.02,
    hurtTimer: 0,
    attackCooldown: 0,
    stuckTimer: 0,
    lastDist: 0,

    update: function() {
      const now = millis();
      const dt = gameDelta || 16.6; 
      const targetX = playerPosition.x;
      const targetY = playerPosition.y;
      const d = dist(this.x, this.y, targetX, targetY);

      // --- STUCK / LONG-RANGE TELEPORT FALLBACK ---
      if (d > 40) {
          this.stuckTimer += dt;
          if (this.stuckTimer > 5000) { // If far away for 5 seconds
              const angle = Math.random() * TWO_PI;
              const r = 15;
              const tx = constrain(targetX + Math.cos(angle) * r, 1, logicalW - 2);
              const ty = constrain(targetY + Math.sin(angle) * r, 1, logicalH - 2);
              if (!isSolid(getTileState(Math.round(tx), Math.round(ty)))) {
                  this.x = tx; this.y = ty;
                  this.renderX = tx; this.renderY = ty;
                  this.stuckTimer = 0;
                  verboseLog('[game] Boss Beetle teleported closer to player');
              }
          }
      } else if (Math.abs(d - (this.lastDist || 0)) < 0.01) {
          this.stuckTimer += dt;
          if (this.stuckTimer > 3000) { // If stuck for 3 seconds
              // Force move in random direction to unstick
              const angle = Math.random() * TWO_PI;
              this.x += Math.cos(angle) * 2;
              this.y += Math.sin(angle) * 2;
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
        // Melee attack range
        if (d < 1.4 && this.attackCooldown <= 0) {
          this.attacking = true;
          this.attackFrame = 0;
          this.attackTimer = 0;
        } else {
          let dx = targetX - this.x;
          let dy = targetY - this.y;
          const canMoveDirect = d < 8 && !isSolid(getTileState(Math.round(this.x + dx * 0.5), Math.round(this.y + dy * 0.5)));
          
          // Higher chase speed for the Boss
          const moveSpeed = (d < 6) ? 0.08 : 0.06;

          if (canMoveDirect) {
            const mag = Math.sqrt(dx*dx + dy*dy) || 1;
            this.x += (dx / mag) * moveSpeed;
            this.y += (dy / mag) * moveSpeed;
            this.moving = true;
          } else {
            // Increased pathfinding limit for the Boss
            const step = findNextStep(Math.round(this.x), Math.round(this.y), Math.round(targetX), Math.round(targetY), 40); 
            if (step) {
                const stepDX = step.x - this.x;
                const stepDY = step.y - this.y;
                const mag = Math.sqrt(stepDX*stepDX + stepDY*stepDY) || 1;
                this.x += (stepDX / mag) * moveSpeed;
                this.y += (stepDY / mag) * moveSpeed;
                this.moving = true;
            } else {
                // LONG-RANGE FALLBACK: Walk in the general direction of the player
                // Use a larger collision check to prevent getting stuck on corners
                const mag = Math.sqrt(dx*dx + dy*dy) || 1;
                const nextX = this.x + (dx / mag) * moveSpeed;
                const nextY = this.y + (dy / mag) * moveSpeed;
                
                if (!isSolid(getTileState(Math.round(nextX), Math.round(nextY)))) {
                    this.x = nextX;
                    this.y = nextY;
                    this.moving = true;
                } else {
                    // Try to slide along walls
                    if (!isSolid(getTileState(Math.round(nextX), Math.round(this.y)))) {
                        this.x = nextX;
                        this.moving = true;
                    } else if (!isSolid(getTileState(Math.round(this.x), Math.round(nextY)))) {
                        this.y = nextY;
                        this.moving = true;
                    }
                }
            }
          }
          if (Math.abs(dx) > Math.abs(dy)) this.direction = dx > 0 ? 'E' : 'W';
          else this.direction = dy > 0 ? 'S' : 'N';
        }
      }

      if (this.attacking) {
        this.attackTimer += dt;
        
        // LUNGE MECHANIC: Beetle lunges forward during the first 4 frames
        if (this.attackFrame < 4) {
            const lungeSpeed = 0.06;
            let lx = targetX - this.x;
            let ly = targetY - this.y;
            const lMag = Math.sqrt(lx*lx + ly*ly) || 1;
            this.x += (lx / lMag) * lungeSpeed;
            this.y += (ly / lMag) * lungeSpeed;
        }

        if (this.attackTimer > 100) { // Slightly faster attack animation
          this.attackTimer = 0;
          this.attackFrame++;
          
          if (this.attackFrame === 4) {
            const currentDist = dist(this.renderX, this.renderY, playerPosition.x, playerPosition.y);
            // Check for i-frames (playerHurtTimer)
            if (currentDist < 1.8 && playerHurtTimer <= 0) { // Reduced hitbox from 2.5 to 1.8
                playerHealth = Math.max(0, playerHealth - 1);
                spawnDamageText("-1", playerPosition.x, playerPosition.y, [255, 0, 0]);
                playerHurtTimer = 800; // Longer i-frames for boss hit
                screenShakeTimer = 400;
                screenShakeAmount = 20;
                
                // Add knockback - snap to nearest valid tile to prevent movement lock
                const kx = playerPosition.x - this.x;
                const ky = playerPosition.y - this.y;
                const km = Math.sqrt(kx*kx + ky*ky) || 1;
                const knockX = Math.round(playerPosition.x + (kx/km) * 1.5);
                const knockY = Math.round(playerPosition.y + (ky/km) * 1.5);
                if (knockX >= 0 && knockX < logicalW && knockY >= 0 && knockY < logicalH
                    && !isSolid(getTileState(knockX, knockY))) {
                    playerPosition.x = knockX;
                    playerPosition.y = knockY;
                } else {
                    // Fallback: try rounding without knockback distance
                    const fallbackX = Math.round(playerPosition.x + (kx/km) * 0.5);
                    const fallbackY = Math.round(playerPosition.y + (ky/km) * 0.5);
                    if (fallbackX >= 0 && fallbackX < logicalW && fallbackY >= 0 && fallbackY < logicalH
                        && !isSolid(getTileState(fallbackX, fallbackY))) {
                        playerPosition.x = fallbackX;
                        playerPosition.y = fallbackY;
                    }
                }
            }
          }
          
          if (this.attackFrame >= 6) {
            this.attacking = false;
            this.attackFrame = 0;
            this.attackCooldown = 1200; // 1.2s cooldown between attacks
          }
        }
      }

      // Beetle is large and fast — always render at actual position to prevent invisibility
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
        sprite = beetleAttackSprite;
        frameCount = 6;
        frame = Math.min(this.attackFrame, 5);
        if (this.direction === 'S') row = 0;
        else if (this.direction === 'W') row = 1;
        else if (this.direction === 'E') row = 2;
        else if (this.direction === 'N') row = 3;
        // Fallback to move sprite if attack sprite didn't load
        if (!sprite) {
          sprite = beetleMoveSprite;
          frameCount = 4;
          frame = 0;
        }
      } else {
        sprite = beetleMoveSprite;
        frameCount = 4;
        if (this.moving) frame = Math.floor(millis() / 150) % frameCount;
        else frame = 0;

        if (this.direction === 'S') row = 0;
        else if (this.direction === 'W') row = 1;
        else if (this.direction === 'E') row = 2;
        else if (this.direction === 'N') row = 3;
      }

      if (!sprite) return;

      const tw = 32, th = 32;
      const sx = frame * tw;
      const sy = row * th;

      // Use world coordinates (same as mantis/maggot) — the camera translate handles the rest
      const destX = this.renderX * cellSize;
      const destY = this.renderY * cellSize;

      // Center the 80x80 boss sprite on its tile
      const drawSize = 80;
      const drawX = destX + (cellSize / 2) - (drawSize / 2);
      const drawY = destY + cellSize - drawSize; // anchor bottom

      push();
      // Hit flash visual
      if (this.hurtTimer > 0) {
          tint(255, 100, 100);
      }
      // Draw 32x32 source frame scaled up to 80x80 (Boss size)
      image(sprite, drawX, drawY, drawSize, drawSize, sx, sy, tw, th);
      noTint();
      pop();

      // Health bar
      noStroke();
      const barW = 60;
      const barH = 6;
      const barX = destX + (cellSize - barW) / 2;
      const barY = drawY - 8;
      fill(0, 100);
      rect(barX, barY, barW, barH);
      fill(255, 0, 0);
      rect(barX, barY, barW * (this.health / this.maxHealth), barH);
    }
  };
}

function createMantis(startX, startY) {
  return {
    type: 'mantis',
    x: startX,
    y: startY,
    health: 3,
    maxHealth: 3,
    hurtTimer: 0,
    panicTimer: 0,
    isPanicking: false,
    renderX: startX,
    renderY: startY,
    direction: 'S', // S, E, W, N
    moving: false,
    animFrame: 0,
    animTimer: 0,
    moveTimer: 0,
    
    // Attack properties
    attacking: false,
    attackFrame: 0,
    attackTimer: 0,
    attackCooldown: 0,
    hasDealtDamage: false,
    
    update: function() {
      const now = millis();
      const dt = gameDelta;

      // --- ATTACK STATE ---
      if (this.attacking) {
         this.attackTimer += dt;
         if (this.attackTimer > 100) { // Speed of attack animation
             this.attackTimer = 0;
             this.attackFrame++;
             
             // Damage Frame (e.g., frame 4)
             if (this.attackFrame === 4 && !this.hasDealtDamage) {
                 if (playerPosition) {
                     const dist = Math.hypot(playerPosition.x - this.x, playerPosition.y - this.y);
                     // Check for i-frames
                     if (dist < 1.5 && playerHurtTimer <= 0) { 
                         playerHealth = Math.max(0, playerHealth - 1);
                         this.hasDealtDamage = true;
                         playerHurtTimer = 600; // Standard i-frames
                         spawnDamageText("-1", playerPosition.x, playerPosition.y, [255, 0, 0]);
                         
                         // Add knockback - snap to nearest valid tile
                         const kx = playerPosition.x - this.x;
                         const kdy = playerPosition.y - this.y;
                         const km = Math.sqrt(kx*kx + kdy*kdy) || 1;
                         const knockX = Math.round(playerPosition.x + (kx/km) * 0.8);
                         const knockY = Math.round(playerPosition.y + (kdy/km) * 0.8);
                         if (knockX >= 0 && knockX < logicalW && knockY >= 0 && knockY < logicalH
                             && !isSolid(getTileState(knockX, knockY))) {
                             playerPosition.x = knockX;
                             playerPosition.y = knockY;
                         }
                     }
                 }
             }

             if (this.attackFrame >= 7) {
                 this.attacking = false;
                 this.attackCooldown = 1500; // 1.5s cooldown
                 this.attackFrame = 0;
             }
         }
         return; // Don't move while attacking
      }

      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.hurtTimer > 0) this.hurtTimer -= dt;
      if (this.panicTimer > 0) this.panicTimer -= dt;

      // TRIGGER PANIC
      if (this.health === 1 && !this.isPanicking && this.panicTimer <= 0) {
          this.isPanicking = true;
          this.panicTimer = 4000; 
          verboseLog('[game] Mantis is panicking!');
      }
      if (this.panicTimer <= 0) this.isPanicking = false;

      // --- MOVEMENT & AGGRO ---
      this.animTimer += dt;
      if (this.animTimer > 200) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }
      
      const speed = 0.15;
      if (Math.abs(this.renderX - this.x) > 0.01) this.renderX = lerp(this.renderX, this.x, speed);
      else this.renderX = this.x;
      
      if (Math.abs(this.renderY - this.y) > 0.01) this.renderY = lerp(this.renderY, this.y, speed);
      else this.renderY = this.y;
      
      if (this.moveTimer > 0) {
        this.moveTimer -= dt;
        return;
      }
      
      // AGGRO LOGIC
      let targetX = null;
      let targetY = null;
      let isAggro = false;

      if (playerPosition) {
          const dist = Math.hypot(playerPosition.x - this.x, playerPosition.y - this.y);
          
          if (this.isPanicking) {
              isAggro = true;
              targetX = this.x + (this.x - playerPosition.x);
              targetY = this.y + (this.y - playerPosition.y);
          } else {
              // Trigger Attack if close and cooldown ready
              if (dist < 1.5 && this.attackCooldown <= 0) {
                  this.attacking = true;
                  this.attackFrame = 0;
                  this.attackTimer = 0;
                  this.hasDealtDamage = false;
                  // Face player before attacking
                  const dx = playerPosition.x - this.x;
                  const dy = playerPosition.y - this.y;
                  if (Math.abs(dx) > Math.abs(dy)) {
                      this.direction = dx > 0 ? 'E' : 'W';
                  } else {
                      this.direction = dy > 0 ? 'S' : 'N';
                  }
                  return;
              }

              if (dist < 8) { // Aggro range
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
              let newDir = this.direction;
              if (dx > 0) newDir = 'E';
              else if (dx < 0) newDir = 'W';
              else if (dy > 0) newDir = 'S';
              else if (dy < 0) newDir = 'N';
              
              this.x = nextStep.x;
              this.y = nextStep.y;
              this.direction = newDir;
              this.moveTimer = 400; // Faster movement when aggro
              return;
          }

          // Fallback to basic movement if pathfinding fails or is out of range
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          
          let moveX = 0;
          let moveY = 0;
          let newDir = this.direction;

          if (Math.abs(dx) > Math.abs(dy)) {
              if (dx > 0) { moveX = 1; newDir = 'E'; }
              else { moveX = -1; newDir = 'W'; }
          } else {
              if (dy > 0) { moveY = 1; newDir = 'S'; }
              else { moveY = -1; newDir = 'N'; }
          }
          
          // Try primary direction
          let nx = this.x + moveX;
          let ny = this.y + moveY;
          let canMove = false;
          
          const isWater = (tx, ty) => getTileState(tx, ty) === TILE_TYPES.RIVER;

          if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH && typeof isSolid === 'function' && !isSolid(getTileState(nx, ny)) && !isWater(nx, ny)) {
              canMove = true;
          } else {
             // Try secondary axis if primary blocked
             moveX = 0; moveY = 0;
             if (Math.abs(dx) > Math.abs(dy)) { // Original was X, try Y
                 if (dy > 0) { moveY = 1; newDir = 'S'; } else if (dy < 0) { moveY = -1; newDir = 'N'; }
             } else { // Original was Y, try X
                 if (dx > 0) { moveX = 1; newDir = 'E'; } else if (dx < 0) { moveX = -1; newDir = 'W'; }
             }
             if (moveX !== 0 || moveY !== 0) {
                 nx = this.x + moveX;
                 ny = this.y + moveY;
                 if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH && typeof isSolid === 'function' && !isSolid(getTileState(nx, ny)) && !isWater(nx, ny)) {
                     canMove = true;
                 }
             }
          }

          if (canMove) {
              this.x = nx;
              this.y = ny;
              this.direction = newDir;
              this.moveTimer = 400; // Faster movement when aggro
              return;
          }
      }

      // IDLE WANDER
      if (Math.random() < 0.02) {
        const dirs = [
            { dx: 0, dy: 1, dir: 'S' },
            { dx: 0, dy: -1, dir: 'N' },
            { dx: 1, dy: 0, dir: 'E' },
            { dx: -1, dy: 0, dir: 'W' }
        ];
        const choice = dirs[Math.floor(Math.random() * dirs.length)];
        const nx = this.x + choice.dx;
        const ny = this.y + choice.dy;
        
        if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH) {
            const ts = getTileState(nx, ny);
            if (typeof isSolid === 'function' && !isSolid(ts) && ts !== TILE_TYPES.RIVER) {
                this.x = nx;
                this.y = ny;
                this.direction = choice.dir;
                this.moveTimer = 1000 + Math.random() * 2000;
            }
        }
      }
    },
    
    draw: function() {
        let sprite = mantisMoveSprite;
        let frame = this.animFrame;
        let cols = 4;
        let maxFrames = 4;

        if (this.attacking && mantisAttackSprite) {
            sprite = mantisAttackSprite;
            frame = this.attackFrame;
            cols = 7;
            maxFrames = 7;
        }

        if (!sprite) return;
        
        let row = 0;
        if (this.direction === 'S') row = 0;
        else if (this.direction === 'E') row = 1;
        else if (this.direction === 'W') row = 2;
        else if (this.direction === 'N') row = 3;
        
        const fw = sprite.width / cols;
        const fh = sprite.height / 4;
        
        const sx = frame * fw;
        const sy = row * fh;
        
        const destX = this.renderX * cellSize;
        const destY = this.renderY * cellSize;
        
        let tx = 0, ty = 0;
        if (this.attacking && this.attackFrame < 4) {
            tx = random(-2, 2);
            ty = random(-2, 2);
        }

        // Draw slightly larger than cell
        const drawH = cellSize * 1.2;
        const drawW = drawH * (fw / fh);
        
        const drawX = destX + (cellSize - drawW) / 2;
        const drawY = destY + (cellSize - drawH); // anchor bottom
        
        if (this.hurtTimer > 0) tint(255, 0, 0);
        image(sprite, drawX + tx, drawY + ty, drawW, drawH, sx, sy, fw, fh);
        if (this.hurtTimer > 0) noTint();

        // Draw Health Bar if damaged
        if (this.health < this.maxHealth) {
            const barW = cellSize * 0.8;
            const barH = 4;
            const barX = destX + (cellSize - barW) / 2;
            const barY = drawY - 8;
            
            fill(0, 150); noStroke();
            rect(barX, barY, barW, barH);
            fill(255, 0, 0);
            rect(barX, barY, barW * (this.health / this.maxHealth), barH);
        }
    }
  };
}

function createMaggot(startX, startY) {
  return {
    type: 'maggot',
    x: startX,
    y: startY,
    health: 2,
    maxHealth: 2,
    hurtTimer: 0,
    panicTimer: 0,
    isPanicking: false,
    renderX: startX,
    renderY: startY,
    direction: 'S', // S, W, E, N (Row 0, 1, 2, 3)
    moving: false,
    animFrame: 0,
    animTimer: 0,
    moveTimer: 0,
    
    // Attack properties
    attacking: false,
    attackFrame: 0,
    attackTimer: 0,
    attackCooldown: 0,
    hasSpawnedProjectile: false,
    
    update: function() {
      const dt = gameDelta;

      // --- ATTACK STATE ---
      if (this.attacking) {
         this.attackTimer += dt;
         if (this.attackTimer > 120) { // Speed of spit animation
             this.attackTimer = 0;
             this.attackFrame++;
             
             // Spawn Projectile Frame (e.g., frame 4)
             if (this.attackFrame === 4 && !this.hasSpawnedProjectile) {
                 if (playerPosition) {
                     spawnAcidBlob(this.x, this.y, playerPosition.x, playerPosition.y, this.direction);
                     this.hasSpawnedProjectile = true;
                 }
             }

             if (this.attackFrame >= 7) {
                 this.attacking = false;
                 this.attackCooldown = 2000; // 2s cooldown
                 this.attackFrame = 0;
             }
         }
         return; // Don't move while spitting
      }

      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.hurtTimer > 0) this.hurtTimer -= dt;
      if (this.panicTimer > 0) this.panicTimer -= dt;

      // TRIGGER PANIC
      if (this.health === 1 && !this.isPanicking && this.panicTimer <= 0) {
          this.isPanicking = true;
          this.panicTimer = 4000;
          verboseLog('[game] Maggot is panicking!');
      }
      if (this.panicTimer <= 0) this.isPanicking = false;

      // --- MOVEMENT & AGGRO ---
      this.animTimer += dt;
      if (this.animTimer > 250) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }
      
      const speed = 0.1;
      if (Math.abs(this.renderX - this.x) > 0.01) this.renderX = lerp(this.renderX, this.x, speed);
      else this.renderX = this.x;
      
      if (Math.abs(this.renderY - this.y) > 0.01) this.renderY = lerp(this.renderY, this.y, speed);
      else this.renderY = this.y;
      
      if (this.moveTimer > 0) {
        this.moveTimer -= dt;
        return;
      }
      
      // AGGRO LOGIC
      if (playerPosition) {
          const dist = Math.hypot(playerPosition.x - this.x, playerPosition.y - this.y);
          
          if (this.isPanicking) {
              const nextStep = findNextStep(this.x, this.y, this.x + (this.x - playerPosition.x), this.y + (this.y - playerPosition.y));
              if (nextStep) {
                  const dx = nextStep.x - this.x;
                  const dy = nextStep.y - this.y;
                  if (dx > 0) this.direction = 'E';
                  else if (dx < 0) this.direction = 'W';
                  else if (dy > 0) this.direction = 'S';
                  else if (dy < 0) this.direction = 'N';
                  this.x = nextStep.x;
                  this.y = nextStep.y;
                  this.moveTimer = 600;
                  return;
              }
          } else {
              // Trigger Attack if in range and cooldown ready
              if (dist < 6 && this.attackCooldown <= 0) {
                  this.attacking = true;
                  this.attackFrame = 0;
                  this.attackTimer = 0;
                  this.hasSpawnedProjectile = false;
                  return;
              }

              // Move closer if noticed but out of range
              if (dist < 10 && dist >= 6) {
                  const nextStep = findNextStep(this.x, this.y, playerPosition.x, playerPosition.y);
                  if (nextStep) {
                      const dx = nextStep.x - this.x;
                      const dy = nextStep.y - this.y;
                      if (dx > 0) this.direction = 'E';
                      else if (dx < 0) this.direction = 'W';
                      else if (dy > 0) this.direction = 'S';
                      else if (dy < 0) this.direction = 'N';
                      
                      this.x = nextStep.x;
                      this.y = nextStep.y;
                      this.moveTimer = 600;
                      return;
                  }
              }
          }
      }

      // IDLE WANDER
      if (Math.random() < 0.01) {
        const dirs = [
            { dx: 0, dy: 1, dir: 'S' },
            { dx: 0, dy: -1, dir: 'N' },
            { dx: 1, dy: 0, dir: 'E' },
            { dx: -1, dy: 0, dir: 'W' }
        ];
        const choice = dirs[Math.floor(Math.random() * dirs.length)];
        const nx = this.x + choice.dx;
        const ny = this.y + choice.dy;
        
        if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH) {
            const ts = getTileState(nx, ny);
            if (typeof isSolid === 'function' && !isSolid(ts) && ts !== TILE_TYPES.RIVER) {
                this.x = nx;
                this.y = ny;
                this.direction = choice.dir;
                this.moveTimer = 1500 + Math.random() * 3000;
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
            cols = 7;
        }

        if (!sprite) return;
        
        let row = 0;
        if (this.direction === 'S') row = 0;
        else if (this.direction === 'W') row = 1;
        else if (this.direction === 'E') row = 2;
        else if (this.direction === 'N') row = 3;
        
        const fw = sprite.width / cols;
        const fh = sprite.height / 4;
        
        const sx = frame * fw;
        const sy = row * fh;
        
        const destX = this.renderX * cellSize;
        const destY = this.renderY * cellSize;
        
        let tx = 0, ty = 0;
        if (this.attacking && this.attackFrame < 4) {
            tx = random(-2, 2);
            ty = random(-2, 2);
        }

        const drawH = cellSize * 1.0;
        const drawW = drawH * (fw / fh);
        
        const drawX = destX + (cellSize - drawW) / 2;
        const drawY = destY + (cellSize - drawH);
        
        if (this.hurtTimer > 0) tint(255, 0, 0);
        image(sprite, drawX + tx, drawY + ty, drawW, drawH, sx, sy, fw, fh);
        if (this.hurtTimer > 0) noTint();

        // Draw Health Bar if damaged
        if (this.health < this.maxHealth) {
            const barW = cellSize * 0.8;
            const barH = 4;
            const barX = destX + (cellSize - barW) / 2;
            const barY = drawY - 8;
            
            fill(0, 150); noStroke();
            rect(barX, barY, barW, barH);
            fill(255, 0, 0);
            rect(barX, barY, barW * (this.health / this.maxHealth), barH);
        }
    }
  };
}

function spawnAcidBlob(startX, startY, targetX, targetY, initialDir) {
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const vx = Math.cos(angle) * 0.15; // Speed in tiles per frame
    const vy = Math.sin(angle) * 0.15;
    
    // Determine projectile direction based on velocity
    let projDir = initialDir;
    if (Math.abs(vx) > Math.abs(vy)) {
        projDir = vx > 0 ? 'E' : 'W';
    } else {
        projDir = vy > 0 ? 'S' : 'N';
    }
    
    projectiles.push({
        type: 'acid_blob',
        x: startX,
        y: startY,
        vx: vx,
        vy: vy,
        direction: projDir,
        animFrame: 0,
        animTimer: 0,
        distanceTraveled: 0,
        maxDistance: 10,
        
        update: function() {
            const dt = gameDelta;
            this.x += this.vx * (dt / 16.67);
            this.y += this.vy * (dt / 16.67);
            this.distanceTraveled += Math.hypot(this.vx, this.vy) * (dt / 16.67);
            
            this.animTimer += dt;
            if (this.animTimer > 80) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % 7;
            }
            
            // Check collision with player
            if (playerPosition) {
                const d = Math.hypot(this.x - playerPosition.x, this.y - playerPosition.y);
                if (d < 0.6 && playerHurtTimer <= 0) {
                    playerHealth = Math.max(0, playerHealth - 1);
                    playerHurtTimer = 600; // Standard i-frames
                    spawnDamageText("-1", playerPosition.x, playerPosition.y, [255, 0, 0]);
                    
                    // Small knockback from projectile - snap to valid tile
                    const km = Math.hypot(this.vx, this.vy) || 1;
                    const knockX = Math.round(playerPosition.x + (this.vx / km) * 0.5);
                    const knockY = Math.round(playerPosition.y + (this.vy / km) * 0.5);
                    if (knockX >= 0 && knockX < logicalW && knockY >= 0 && knockY < logicalH
                        && !isSolid(getTileState(knockX, knockY))) {
                        playerPosition.x = knockX;
                        playerPosition.y = knockY;
                    }
                    
                    return true; // Remove
                } else if (d < 0.6) {
                    // If in i-frames, projectile just vanishes without extra damage
                    return true;
                }
            }
            
            if (this.distanceTraveled > this.maxDistance) return true;
            return false;
        },
        
        draw: function() {
            if (!acidBlobSprite) return;
            let row = 0;
            if (this.direction === 'S') row = 0;
            else if (this.direction === 'W') row = 1;
            else if (this.direction === 'E') row = 2;
            else if (this.direction === 'N') row = 3;
            
            const fw = acidBlobSprite.width / 7;
            const fh = acidBlobSprite.height / 4;
            const sx = this.animFrame * fw;
            const sy = row * fh;
            
            const drawSize = cellSize * 0.8;
            image(acidBlobSprite, this.x * cellSize + (cellSize-drawSize)/2, this.y * cellSize + (cellSize-drawSize)/2, drawSize, drawSize, sx, sy, fw, fh);
        }
    });
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (projectiles[i].update()) {
            projectiles.splice(i, 1);
        }
    }
}

function spawnDamageText(val, x, y, color = [255, 255, 255]) {
    vfx.push({
        type: 'text',
        text: val,
        x: x,
        y: y,
        vx: random(-0.02, 0.02),
        vy: -0.05,
        alpha: 255,
        life: 1000,
        maxLife: 1000,
        color: color,
        update: function(dt) {
            this.x += this.vx * (dt / 16.67);
            this.y += this.vy * (dt / 16.67);
            this.life -= dt;
            this.alpha = (this.life / this.maxLife) * 255;
            return this.life <= 0;
        },
        draw: function() {
            push();
            const px = this.x * cellSize + cellSize/2;
            const py = this.y * cellSize;
            textAlign(CENTER);
            fill(this.color[0], this.color[1], this.color[2], this.alpha);
            stroke(0, this.alpha);
            strokeWeight(2);
            gTextSize(20);
            text(this.text, px, py);
            pop();
        }
    });
}

function spawnSplat(x, y, type = 'acid') {
    const sprite = type === 'egg' ? eggsplosionSprite : acidSplatSprite;
    if (!sprite) return;
    vfx.push({
        type: 'sprite',
        sprite: sprite,
        x: x,
        y: y,
        alpha: 255,
        life: 1500,
        maxLife: 1500,
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

function spawnRipple(x, y) {
    vfx.push({
        type: 'ripple',
        x: x,
        y: y,
        alpha: 150,
        life: 800,
        maxLife: 800,
        size: 5,
        update: function(dt) {
            this.life -= dt;
            this.size += (dt / 16.67) * 0.8;
            this.alpha = (this.life / this.maxLife) * 150;
            return this.life <= 0;
        },
        draw: function() {
            push();
            noFill();
            stroke(255, this.alpha);
            strokeWeight(1.5);
            const px = this.x * cellSize + cellSize/2;
            const py = this.y * cellSize + cellSize/2;
            ellipse(px, py, this.size, this.size * 0.6); // Perspective ripple
            pop();
        }
    });
}

function spawnFirefly() {
    const camX = smoothCamX || 0;
    const camY = smoothCamY || 0;
    // Spawn within viewport range
    const spawnRX = (random(virtualW) - virtualW/2) + camX;
    const spawnRY = (random(virtualH) - virtualH/2) + camY;
    
    vfx.push({
        type: 'firefly',
        x: spawnRX / cellSize,
        y: spawnRY / cellSize,
        vx: random(-0.02, 0.02),
        vy: random(-0.02, 0.02),
        alpha: 0,
        targetAlpha: random(100, 255),
        life: random(4000, 8000),
        maxLife: 8000,
        phase: random(Math.PI * 2),
        update: function(dt) {
            this.life -= dt;
            this.x += this.vx * (dt / 16.67);
            this.y += this.vy * (dt / 16.67);
            this.vx += random(-0.002, 0.002);
            this.vy += random(-0.002, 0.002);
            // Pulse alpha
            this.alpha = map(Math.sin(millis() / 600 + this.phase), -1, 1, 20, this.targetAlpha);
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
                radius: 40,
                color: [180, 255, 80],
                intensity: (this.alpha / 255) * 0.15
            };
        }
    });
}

function updateVFX() {
    const dt = gameDelta;
    for (let i = vfx.length - 1; i >= 0; i--) {
        if (vfx[i].update(dt)) {
            vfx.splice(i, 1);
        }
    }
}

function updateEnemies() {
  if (!enemies) return;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.update) e.update();

    // Environmental Hazard Check (Glitch into trees/walls)
    // Boss Beetle is immune to crushing due to its size
    if (e.type === 'beetle') continue;

    const tx = Math.floor(e.x + 0.5); // Check center of enemy
    const ty = Math.floor(e.y + 0.5);
    
    if (tx >= 0 && tx < logicalW && ty >= 0 && ty < logicalH) {
         const ts = getTileState(tx, ty);
         if (isSolid(ts)) {
             e.health = 0;
             spawnSplat(e.x, e.y, e.type === 'mantis' ? 'acid' : 'egg');
             spawnDamageText(t('crush'), e.x, e.y, [150, 150, 150]);
             enemies.splice(i, 1);
         }
    }
  }
}


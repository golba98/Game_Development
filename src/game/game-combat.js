// Central player-damage path. Callers retain control over damage cadence and knockback.
const GameCombat = {
  applyPlayerDamage: function (options = {}) {
    if (typeof playerHealth !== "number" || playerHealth <= 0) {
      return { applied: false, damage: 0 };
    }
    if (options.respectInvulnerability !== false && playerHurtTimer > 0) {
      return { applied: false, damage: 0 };
    }

    let damage = Math.max(0, Math.floor(Number(options.amount) || 0));
    if (options.applyArmor !== false && typeof equipment !== "undefined" && equipment.armor) {
      damage = Math.max(1, damage - (Number(equipment.armor.defense) || 0));
    }
    if (damage <= 0) return { applied: false, damage: 0 };

    playerHealth = Math.max(0, playerHealth - damage);
    lastHealthChange = typeof millis === "function" ? millis() : Date.now();
    const color = options.color || [255, 70, 55];
    if (typeof spawnDamageText === "function" && playerPosition) {
      spawnDamageText(`-${damage}`, playerPosition.x, playerPosition.y, color);
    }

    const invulnerabilityMs = Math.max(0, Number(options.invulnerabilityMs) || 0);
    if (invulnerabilityMs > 0) playerHurtTimer = invulnerabilityMs;

    const sourceX = Number(options.sourceX);
    const sourceY = Number(options.sourceY);
    const dx = Number.isFinite(sourceX) && playerPosition ? playerPosition.x - sourceX : Number(options.directionX) || 1;
    const dy = Number.isFinite(sourceY) && playerPosition ? playerPosition.y - sourceY : Number(options.directionY) || 0;

    if (typeof options.knockback === "number" && options.knockback > 0 && typeof _knockbackPlayer === "function") {
      _knockbackPlayer(dx, dy, options.knockback, options.knockbackFallback);
    }

    if (typeof CameraShake !== "undefined") {
      CameraShake.kick({
        x: dx,
        y: dy,
        magnitude: Number(options.shakeMagnitude) || 4,
        duration: Number(options.shakeDuration) || 130,
      });
    }

    return { applied: true, damage };
  },
};

if (typeof window !== "undefined") window.GameCombat = GameCombat;

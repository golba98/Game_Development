// Frame-rate-independent camera feedback shared by the p5 and Pixi layers.
const CameraShake = {
  offset: { x: 0, y: 0 },
  impulses: [],
  hitFlash: 0,

  kick: function (options = {}) {
    if (typeof screenShakeEnabled !== "undefined" && !screenShakeEnabled) {
      this.reset();
      return;
    }

    const magnitude = Math.max(0, Number(options.magnitude) || 0);
    if (magnitude === 0) return;

    let x = Number(options.x) || 0;
    let y = Number(options.y) || 0;
    const length = Math.hypot(x, y);
    if (length < 0.001) {
      x = 1;
      y = 0;
    } else {
      x /= length;
      y /= length;
    }

    const duration = Math.max(100, Math.min(160, Number(options.duration) || 130));
    this.impulses.push({ x, y, magnitude, duration, elapsed: 0 });
    if (this.impulses.length > 4) this.impulses.shift();
    this.hitFlash = Math.max(this.hitFlash, Math.min(1, magnitude / 6));
  },

  update: function (dt) {
    if (typeof screenShakeEnabled !== "undefined" && !screenShakeEnabled) {
      this.reset();
      return this.offset;
    }

    const elapsedMs = Math.max(0, Math.min(50, Number(dt) || 0));
    this.offset.x = 0;
    this.offset.y = 0;
    for (let i = this.impulses.length - 1; i >= 0; i--) {
      const impulse = this.impulses[i];
      impulse.elapsed += elapsedMs;
      if (impulse.elapsed >= impulse.duration) {
        this.impulses.splice(i, 1);
        continue;
      }
      const progress = impulse.elapsed / impulse.duration;
      const envelope = Math.cos(progress * Math.PI * 1.5) * Math.pow(1 - progress, 2);
      this.offset.x += impulse.x * impulse.magnitude * envelope;
      this.offset.y += impulse.y * impulse.magnitude * envelope;
    }
    const length = Math.hypot(this.offset.x, this.offset.y);
    if (length > 7) {
      this.offset.x = (this.offset.x / length) * 7;
      this.offset.y = (this.offset.y / length) * 7;
    }
    this.hitFlash = Math.max(0, this.hitFlash - (elapsedMs / 1000) * 8);
    return this.offset;
  },

  reset: function () {
    this.offset.x = 0;
    this.offset.y = 0;
    this.impulses.length = 0;
    this.hitFlash = 0;
  },

  drawHitFlash: function () {
    if (this.hitFlash <= 0 || typeof drawingContext === "undefined") return;
    const w = typeof width === "number" ? width : 0;
    const h = typeof height === "number" ? height : 0;
    if (!w || !h) return;
    const ctx = drawingContext;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
    gradient.addColorStop(0, "rgba(120,0,0,0)");
    gradient.addColorStop(1, `rgba(180,18,8,${(0.28 * this.hitFlash).toFixed(3)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },
};

if (typeof window !== "undefined") window.CameraShake = CameraShake;

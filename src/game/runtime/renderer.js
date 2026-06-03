// runtime/renderer.js — world + overlay rendering pipeline (the "render" layer).
//
// draw() used to inline ~340 lines of drawable building, depth-sorting, viewport
// culling, sprite drawing and the night-lighting pass. That logic now lives here
// as two clearly-named passes so the frame's render stage is explicit and the
// orchestration in draw() stays readable:
//
//   drawWorld()                 — dynamic entity pass: build the per-frame
//                                 drawable pool (with isInView culling), depth
//                                 sort by baseY, then draw overlays/decor/coins/
//                                 player/enemies/projectiles/VFX/portal, and the
//                                 batched ghost pass. Runs inside the world
//                                 transform, after the static map blit.
//
//   drawNightOverlay(camX, camY)— ambient particles, firefly spawning and the
//                                 day/night darkness+lights overlay. camX/camY
//                                 are the floored camera offset (was drawCamX/Y).
//
// The static map layer itself is a single cached blit (image(mapImage,0,0)) and
// stays in draw(); HUD is its own layer (game-hud.js). All state read here is
// global, exactly as before — this is an organizational extraction, not a
// behavior change.

// Persistent scratch objects — allocated once, reused every frame to avoid GC pressure.
const _pRect = { x: 0, y: 0, w: 0, h: 0 };
const _lightsPool = [];

const Renderer = {
  /** Dynamic-entity render pass. Call inside the world transform each frame. */
  drawWorld: function () {
  try {
    drawablePoolIdx = 0;
    currentDrawables.length = 0;
    const _frameMillis = typeof millis === "function" ? millis() : Date.now();

    if (Array.isArray(mapOverlays)) {
      for (const o of mapOverlays) {
        if (!o) continue;
        // Cull overlays whose canopy bbox is outside the viewport
        if (!isInView(o.px, o.py - o.destH, o.destW, o.destH + cellSize))
          continue;
        if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
        const d = drawablePool[drawablePoolIdx++];
        d.type = "overlay";
        d.o = o;
        d.drawX = o.px + Math.floor((cellSize - o.destW) / 2);
        d.drawY = o.py + (cellSize - o.destH);
        d.baseY = o.py + cellSize;
        currentDrawables.push(d);
      }
    }
    if (Array.isArray(decorativeObjectsList) && decorativeObjectsList.length) {
      for (const deco of decorativeObjectsList) {
        const img = DECOR_ASSET_IMAGES[deco.id];
        if (!img) continue;
        const destW = img.width || cellSize;
        const destH = img.height || cellSize;
        if (
          !isInView(
            deco.tileX * cellSize,
            deco.tileY * cellSize - destH,
            destW,
            destH + cellSize,
          )
        )
          continue;
        if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
        const d = drawablePool[drawablePoolIdx++];
        d.type = "decor";
        d.img = img;
        d.drawX = deco.tileX * cellSize + Math.floor((cellSize - destW) / 2);
        d.drawY = deco.tileY * cellSize + (cellSize - destH);
        d.destW = destW;
        d.destH = destH;
        d.baseY = deco.tileY * cellSize + cellSize;
        currentDrawables.push(d);
      }
    }

    if (typeof activeCoins !== "undefined" && activeCoins) {
      for (const coin of activeCoins) {
        if (!isInView(coin.x * cellSize, coin.y * cellSize, cellSize, cellSize))
          continue;
        if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
        const d = drawablePool[drawablePoolIdx++];
        d.type = "coin";
        d.tileX = coin.x;
        d.tileY = coin.y;
        d.baseY = coin.y * cellSize + cellSize;
        currentDrawables.push(d);
      }
    }

    if (playerPosition) {
      const drawTileX = isMoving ? renderX : playerPosition.x;
      const drawTileY = isMoving ? renderY : playerPosition.y;
      if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
      const d = drawablePool[drawablePoolIdx++];
      d.type = "player";
      d.baseY = drawTileY * cellSize + cellSize;
      currentDrawables.push(d);
    }
    if (enemies && enemies.length) {
      for (const e of enemies) {
        // Generous box (enemy sprites can be several cells tall/wide)
        if (
          !isInView(
            e.renderX * cellSize - cellSize * 2,
            e.renderY * cellSize - cellSize * 2,
            cellSize * 4,
            cellSize * 4,
          )
        )
          continue;
        if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
        const d = drawablePool[drawablePoolIdx++];
        d.type = "enemy";
        d.entity = e;
        d.baseY = e.renderY * cellSize + cellSize;
        currentDrawables.push(d);
      }
    }
    if (projectiles && projectiles.length) {
      for (const p of projectiles) {
        if (
          !isInView(
            p.x * cellSize - cellSize,
            p.y * cellSize - cellSize,
            cellSize * 2,
            cellSize * 2,
          )
        )
          continue;
        if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
        const d = drawablePool[drawablePoolIdx++];
        d.type = "projectile";
        d.entity = p;
        d.baseY = p.y * cellSize + cellSize;
        currentDrawables.push(d);
      }
    }
    if (vfx && vfx.length) {
      for (const effect of vfx) {
        if (
          !isInView(
            effect.x * cellSize - cellSize * 2,
            effect.y * cellSize - cellSize * 2,
            cellSize * 4,
            cellSize * 4,
          )
        )
          continue;
        if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
        const d = drawablePool[drawablePoolIdx++];
        d.type = "vfx";
        d.entity = effect;
        d.baseY = effect.y * cellSize + cellSize;
        currentDrawables.push(d);
      }
    }
    if (
      portalPos &&
      isInView(
        portalPos.x * cellSize - cellSize,
        portalPos.y * cellSize - cellSize * 2,
        cellSize * 3,
        cellSize * 3,
      )
    ) {
      if (drawablePoolIdx >= drawablePool.length) drawablePool.push({});
      const d = drawablePool[drawablePoolIdx++];
      d.type = "portal";
      d.x = portalPos.x;
      d.y = portalPos.y;
      d.baseY = portalPos.y * cellSize + cellSize;
      currentDrawables.push(d);
    }
    currentDrawables.sort((a, b) => a.baseY - b.baseY);

    if (typeof PerfOverlay !== "undefined" && PerfOverlay.enabled) {
      const candidates =
        (Array.isArray(mapOverlays) ? mapOverlays.length : 0) +
        (Array.isArray(decorativeObjectsList) ? decorativeObjectsList.length : 0) +
        (activeCoins ? activeCoins.length : 0) +
        (enemies ? enemies.length : 0) +
        (projectiles ? projectiles.length : 0) +
        (vfx ? vfx.length : 0) +
        (portalPos ? 1 : 0) +
        (playerPosition ? 1 : 0);
      PerfOverlay.recordDrawables(
        candidates,
        currentDrawables.length,
        vfx ? vfx.length : 0,
      );
    }

    // Calculate player bounding box for fading (reuses module-level _pRect, no allocation)
    let pRect = null;
    if (playerPosition) {
      const pX = isMoving ? renderX : playerPosition.x;
      const pY = isMoving ? renderY : playerPosition.y;
      const pW = cellSize;
      const pH = cellSize * PLAYER_BBOX_HEIGHT_SCALE;
      _pRect.x = pX * cellSize + cellSize / 2 - pW / 2;
      _pRect.y = pY * cellSize + cellSize - pH;
      _pRect.w = pW;
      _pRect.h = pH;
      pRect = _pRect;
    }

    for (const d of currentDrawables) {
      switch (d.type) {
        case "overlay": {
          // In Pixi mode, PixiEntityRenderer draws these as WebGL sprites
          if (typeof RENDER_BACKEND !== 'undefined' && RENDER_BACKEND === 'pixi') break;
          const o = d.o;
          let alpha = 255;
          // Fade tree if player is visually behind it
          if (pRect && d.baseY > pRect.y + pRect.h * 0.5) {
            if (
              pRect.x < d.drawX + o.destW &&
              pRect.x + pRect.w > d.drawX &&
              pRect.y < d.drawY + o.destH &&
              pRect.y + pRect.h > d.drawY
            ) {
              alpha = 140;
            }
          }
          if (alpha < 255) tint(255, alpha);
          if (o.imgType === "image" && o.img)
            image(
              getPrescaledImage(o.img, o.destW, o.destH),
              d.drawX,
              d.drawY,
              o.destW,
              o.destH,
            );
          else if (o.imgType === "sheet" && o.s)
            image(
              spritesheet,
              d.drawX,
              d.drawY,
              o.destW,
              o.destH,
              o.s.x,
              o.s.y,
              o.s.w,
              o.s.h,
            );
          if (alpha < 255) noTint();
          break;
        }
        case "decor":
          // In Pixi mode, PixiEntityRenderer draws these as WebGL sprites
          if (typeof RENDER_BACKEND !== 'undefined' && RENDER_BACKEND === 'pixi') break;
          try {
            if (d.img)
              image(
                getPrescaledImage(d.img, d.destW, d.destH),
                d.drawX,
                d.drawY,
                d.destW,
                d.destH,
              );
          } catch (e) {}
          break;
        case "coin": {
          // In Pixi mode, PixiEntityRenderer draws these as animated WebGL sprites
          if (typeof RENDER_BACKEND !== 'undefined' && RENDER_BACKEND === 'pixi') break;
          if (coinAnimSprite && coinAnimSprite.width > 0) {
            const frameCount = 4;
            const frame = Math.floor(_frameMillis / 150) % frameCount;
            const fw = coinAnimSprite.width / frameCount;
            const fh = coinAnimSprite.height;
            const drawSize = cellSize * 0.8;
            image(
              coinAnimSprite,
              d.tileX * cellSize + (cellSize - drawSize) / 2,
              d.tileY * cellSize + (cellSize - drawSize) / 2,
              drawSize,
              drawSize,
              frame * fw,
              0,
              fw,
              fh,
            );
          }
          break;
        }
        case "player":
          try {
            drawPlayer();
          } catch (e) {}
          break;
        case "enemy":
          // Ghosts are batched after the main loop under one blend-mode switch
          if (d.entity && d.entity.type === "ghost") break;
          try {
            d.entity.draw();
          } catch (e) {}
          break;
        case "projectile":
        case "vfx":
          try {
            d.entity.draw();
          } catch (e) {}
          break;
        case "portal": {
          // In Pixi mode, PixiEntityRenderer draws these as animated WebGL sprites
          if (typeof RENDER_BACKEND !== 'undefined' && RENDER_BACKEND === 'pixi') break;
          const sheet = isPortalActive
            ? portalActiveSheet
            : portalInactiveSheet;
          if (sheet && sheet.width > 0) {
            const frameCount = 6;
            const frame = Math.floor(_frameMillis / 150) % frameCount;
            const fw = sheet.width / frameCount;
            const fh = sheet.height;
            const drawSize = cellSize * 2.0;
            image(
              sheet,
              d.x * cellSize + (cellSize - drawSize) / 2,
              d.y * cellSize + (cellSize - drawSize),
              drawSize,
              drawSize,
              frame * fw,
              0,
              fw,
              fh,
            );
          } else {
            // Visual Fallback
            fill(isPortalActive ? [255, 215, 0] : [100, 100, 100], 180);
            stroke(255);
            strokeWeight(2);
            rect(d.x * cellSize, d.y * cellSize, cellSize, cellSize, 4);
            noStroke();
            fill(255);
            textAlign(CENTER);
            gTextSize(10);
            text(
              "PORTAL",
              d.x * cellSize + cellSize / 2,
              d.y * cellSize + cellSize / 2 + 4,
            );
          }
          break;
        }
      }
    }

    // Batch-draw all ghosts under a single blend-mode switch (no allocation).
    if (enemies && enemies.length) {
      let hasGhosts = false;
      for (let gi = 0; gi < enemies.length; gi++) {
        if (enemies[gi].type === "ghost") {
          hasGhosts = true;
          break;
        }
      }
      if (hasGhosts) {
        drawingContext.globalCompositeOperation = "screen";
        for (let gi = 0; gi < enemies.length; gi++) {
          const g = enemies[gi];
          if (g.type === "ghost") {
            if (
              !isInView(
                g.renderX * cellSize - cellSize * 2,
                g.renderY * cellSize - cellSize * 2,
                cellSize * 4,
                cellSize * 4,
              )
            )
              continue;
            try {
              g.draw();
            } catch (e) {}
          }
        }
        drawingContext.globalCompositeOperation = "source-over";
      }
    }
  } catch (e) {}
  },

  /** Day/night ambient particles + dynamic-light darkness overlay. */
  drawNightOverlay: function (camX, camY) {
  // Night  // Weather Overlay Pass
  if (typeof WeatherSystem !== "undefined") {
    const isNight = WeatherSystem.cycle > 0.8 || WeatherSystem.cycle < 0.2;
    WeatherSystem.drawAmbientParticles(smoothCamX, smoothCamY, isNight);
  }
  // Night Ambience: Fireflies
  if (
    typeof WeatherSystem !== "undefined" &&
    (WeatherSystem.cycle < 0.3 || WeatherSystem.cycle > 0.7)
  ) {
    if (showParticles && random(1) < 0.03) {
      spawnFirefly();
    }
  }

  // --- Night overlay — drawn INSIDE the world transform so scale(gameScale) applies ---
  if (typeof WeatherSystem !== "undefined") {
    _lightsPool.length = 0;
    const viewportW = Math.ceil(virtualW || width / gameScale);
    const viewportH = Math.ceil(virtualH || height / gameScale);
    const pushVisibleLight = (x, y, radius) => {
      const r = radius || 40;
      if (x + r < -cellSize || x - r > viewportW + cellSize) return;
      if (y + r < -cellSize || y - r > viewportH + cellSize) return;
      _lightsPool.push({ x, y, radius: r });
    };

    if (playerPosition) {
      const pX = isMoving ? renderX : playerPosition.x;
      const pY = isMoving ? renderY : playerPosition.y;
      const screenX = pX * cellSize + cellSize / 2 - camX;
      const screenY = pY * cellSize + cellSize / 2 - camY;

      const baseRadius =
        typeof WeatherSystem !== "undefined" &&
        typeof WeatherSystem.getLightRadius === "function"
          ? WeatherSystem.getLightRadius()
          : 450;
      pushVisibleLight(screenX, screenY, baseRadius + Math.sin(millis() / 200) * 10);
    }
    // Add lights from VFX (like fireflies)
    if (vfx && vfx.length) {
      for (const effect of vfx) {
        if (!showFireflyLighting && effect.type === "firefly") continue;
        if (typeof effect.getLight === "function") {
          const l = effect.getLight();
          if (l) {
            pushVisibleLight(l.worldX - camX, l.worldY - camY, l.radius || 40);
          }
        }
      }
    }
    // Add lights from enemies (ghost glow)
    if (enemies && enemies.length) {
      for (const e of enemies) {
        if (typeof e.getLight === "function") {
          const l = e.getLight();
          if (l) {
            pushVisibleLight(l.worldX - camX, l.worldY - camY, l.radius || 40);
          }
        }
      }
    }

    WeatherSystem.drawOverlay(viewportW, viewportH, _lightsPool, camX, camY);
  }
  },
};

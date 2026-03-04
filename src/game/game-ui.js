// game-ui.js — In-game menus, transitions, victory/game-over, audio helpers
// Extracted from 4-Game.js

function openInGameMenu() {
  if (inGameMenuOverlay) {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
  }
  try {
    loadLocalSettings();
  } catch (e) {}
  try { applyCurrentTextSize(); } catch (e) {}
  
  inGameMenuVisible = true;
  
  const { container, panel, close } = createZoomStablePanel(420, 320, 'gd-ingame-menu');
  inGameMenuOverlay = { close, container };

  // Title positioned well above the panel box
  let title = createDiv(t('paused'));
  title.parent(panel);
  title.style('position', 'absolute');
  title.style('width', '100%');
  title.style('text-align', 'center');
  title.style('top', '-100px'); // 100px above the top of the box
  title.style('left', '0');
  title.style('font-size', '48px');
  title.style('font-weight', 'bold');
  title.style('color', '#000');
  title.style('text-shadow', 'none');

  const createMenuBtn = (label, onClick) => {
    let btn = createButton(label);
    btn.parent(panel);
    btn.style('margin-bottom', '20px');
    applyMenuButtonUI(btn, 260, 48);
    btn.mousePressed(onClick);
    return btn;
  };

  createMenuBtn(t('resume'), () => {
    closeInGameMenu();
  });

  createMenuBtn(t('settings'), () => {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
    openInGameSettings({ masterVol, musicVol, sfxVol, difficulty: currentDifficulty });
  });

  createMenuBtn(t('exit'), () => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'close-game-overlay' }, '*');
      }
    } catch (e) {}
  });
}

function closeInGameMenu() {
  if (inGameMenuOverlay) {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
  }
  inGameMenuVisible = false;
  try { if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize(); } catch(e) {}
}

function startLevelTransition() {
  if (isTransitioning) return;
  isTransitioning = true;
  transitionAlpha = 0;
  
  try { showToast(t('level_clear', currentLevel, currentLevel + 1), 'info', 4000); } catch(e) {}
}

function handleTransitionLogic() {
  if (!isTransitioning) return;
  
  const dt = gameDelta || 16.6;
  const fadeSpeed = 4; // Fade out in ~60 frames
  
  if (transitionAlpha < 255) {
      transitionAlpha = Math.min(255, transitionAlpha + fadeSpeed);
      if (transitionAlpha === 255) {
          // At peak blackout, swap the world
          currentLevel++;
          generateMap();
          // Reset player for the new world
          playerHealth = maxHealth;
          isPortalActive = false;
          victoryShown = false;
      }
  } else {
      // Fading back in (handled in generateMap which usually resets stuff, 
      // but let's be explicit)
      // Actually, let's wait a moment at black
      setTimeout(() => {
          isTransitioning = false;
          // Fade in is handled by naturally letting draw run 
          // without drawing the black rect once isTransitioning is false.
          // For a true fade-in, we'd need another state, 
          // but for now, simple is better.
      }, 500);
  }
}

function triggerGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  showGameOverScreen();
}

function hasAnyCoins() {
  if (!mapStates) return false;
  for (let i = 0; i < mapStates.length; i++) {
    if (mapStates[i] === TILE_TYPES.COIN) return true;
  }
  return false;
}

function triggerVictory() {
  if (victoryShown) return;
  victoryShown = true;
  isPortalActive = true;

  // Immediately kill any player movement inputs
  isMoving = false;
  queuedMove = null;
  prevKeyA = prevKeyD = prevKeyW = prevKeyS = false;
  if (holdState) {
      holdState.A.start = holdState.D.start = holdState.W.start = holdState.S.start = 0;
  }

  showVictoryScreen();
}

function showVictoryScreen() {
  if (victoryOverlay) {
    victoryOverlay.close();
    victoryOverlay = null;
  }
  
  const { container, panel, close } = createZoomStablePanel(420, 320, 'gd-victory-menu');
  victoryOverlay = { close, container };

  let title = createDiv(t('victory'));
  title.parent(panel);
  title.style('position', 'absolute');
  title.style('width', '100%');
  title.style('text-align', 'center');
  title.style('top', '-100px');
  title.style('left', '0');
  title.style('font-size', '48px');
  title.style('font-weight', 'bold');
  title.style('color', '#000');
  title.style('text-shadow', 'none');

  let msg = createDiv(t('victory_msg', playerScore));
  msg.parent(panel);
  msg.style('text-align', 'center');
  msg.style('margin-bottom', '30px');
  msg.style('font-size', '20px');
  msg.style('color', '#fff');

  const createMenuBtn = (label, onClick) => {
    let btn = createButton(label);
    btn.parent(panel);
    btn.style('margin-bottom', '20px');
    applyMenuButtonUI(btn, 260, 48);
    btn.mousePressed(onClick);
    return btn;
  };

  createMenuBtn(t('continue_btn'), () => {
    if (victoryOverlay) {
        victoryOverlay.close();
        victoryOverlay = null;
    }
  });
}

function showGameOverScreen() {
  if (gameOverOverlay) {
    gameOverOverlay.close();
    gameOverOverlay = null;
  }
  
  const { container, panel, close } = createZoomStablePanel(420, 320, 'gd-gameover-menu');
  gameOverOverlay = { close, container };

  // Title positioned well above the panel box
  let title = createDiv(t('game_over'));
  title.parent(panel);
  title.style('position', 'absolute');
  title.style('width', '100%');
  title.style('text-align', 'center');
  title.style('top', '-100px');
  title.style('left', '0');
  title.style('font-size', '48px');
  title.style('font-weight', 'bold');
  title.style('color', '#000');
  title.style('text-shadow', 'none');

  let msg = createDiv(t('gameover_msg', playerScore));
  msg.parent(panel);
  msg.style('text-align', 'center');
  msg.style('margin-bottom', '30px');
  msg.style('font-size', '20px');
  msg.style('color', '#fff');

  const createMenuBtn = (label, onClick) => {
    let btn = createButton(label);
    btn.parent(panel);
    btn.style('margin-bottom', '20px');
    applyMenuButtonUI(btn, 260, 48);
    btn.mousePressed(onClick);
    return btn;
  };

  createMenuBtn(t('restart'), () => {
    restartGame();
  });

  createMenuBtn(t('exit_to_menu'), () => {
    exitToMenu();
  });
}

function restartGame() {
  if (gameOverOverlay) {
    gameOverOverlay.close();
    gameOverOverlay = null;
  }
  isGameOver = false;
  playerHealth = maxHealth;
  
  if (initialSpawnPosition) {
    playerPosition = { x: initialSpawnPosition.x, y: initialSpawnPosition.y };
    renderX = playerPosition.x;
    renderY = playerPosition.y;
    renderStartX = renderX;
    renderStartY = renderY;
    renderTargetX = renderX;
    renderTargetY = renderY;
    isMoving = false;
  }
  
  projectiles = [];
  
  if (initialEnemies && initialEnemies.length > 0) {
    enemies = [];
    for (const e of initialEnemies) {
      spawnEnemy(e.type, e.x, e.y);
    }
  }
  
  try { if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize(); } catch(e) {}
}

function exitToMenu() {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'close-game-overlay' }, '*');
    }
  } catch (e) {}
  window.location.href = '1-Menu_Index.html';
}

function drawInGameMenu() { return; }

function drawInGameMenu_OLD() {
  if (!inGameMenuVisible) return;
  try {
    push();
    
  
    const vW = virtualW || (width / gameScale);
    const vH = virtualH || (height / gameScale);

    
    let currentHoveredId = null;
    const mx = mouseX / gameScale;
    const my = mouseY / gameScale;
    
    if (typeof mx === 'number' && typeof my === 'number') {
      for (let i = inGameMenuButtonRects.length - 1; i >= 0; i--) {
        const r = inGameMenuButtonRects[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          currentHoveredId = r.id;
          break;
        }
      }
    }
    inGameMenuHovered = currentHoveredId;


    noStroke();
    fill(0, 0, 0, 200);
    rect(0, 0, vW, vH); 


    const panelW = 500; 
    const panelH = 400;
    
    const px = Math.floor((vW - panelW) / 2);
    const py = Math.floor((vH - panelH) / 2);


    push();
    stroke(0); strokeWeight(6); fill(40, 40, 44, 255); 
    rect(px, py, panelW, panelH, 12);
    pop();

    try {
      if (ESC_MENU_BACKGROUND) {
        const imgAspect = ESC_MENU_BACKGROUND.width / ESC_MENU_BACKGROUND.height;
        const panelAspect = panelW / panelH;
        let imgW, imgH;
        if (imgAspect > panelAspect) { imgW = panelW; imgH = panelW / imgAspect; } 
        else { imgH = panelH; imgW = panelH * imgAspect; }
        const imgX = px + (panelW - imgW) / 2;
        const imgY = py + (panelH - imgH) / 2;
        image(ESC_MENU_BACKGROUND, imgX, imgY, imgW, imgH);
      }
    } catch (e) {}


    const btnLabels = [ { id: 'continue', label: 'Continue' }, { id: 'settings', label: 'Settings' }, { id: 'exit', label: 'Exit' } ];
    const btnW = 320; 
    const btnH = 60;  
    const gap = 15;
    
    const totalH = btnH * btnLabels.length + gap * (btnLabels.length - 1);
    const startY = py + (panelH - totalH) / 2;

    inGameMenuButtonRects = [];

    for (let i = 0; i < btnLabels.length; i++) {
      const b = btnLabels[i];
      const bx = px + (panelW - btnW) / 2;
      const by = startY + i * (btnH + gap);

      const currentScaleVal = (inGameMenuHoverScales[b.id] || 1);
      const desired = (inGameMenuHovered === b.id) ? 1.05 : 1.0;
      inGameMenuHoverScales[b.id] = lerp(currentScaleVal, desired, 0.2);

      const drawW = Math.floor(btnW * inGameMenuHoverScales[b.id]);
      const drawH = Math.floor(btnH * inGameMenuHoverScales[b.id]);
      const drawX = Math.floor(bx - (drawW - btnW) / 2);
      const drawY = Math.floor(by - (drawH - btnH) / 2);

      try {
        if (BUTTON_BG) image(BUTTON_BG, drawX, drawY, drawW, drawH);
        else { push(); noStroke(); fill(70); rect(drawX, drawY, drawW, drawH, 10); pop(); }
      } catch (e) {}

      try {
        push();
        textFont(uiFont || 'Arial');
        textAlign(CENTER, CENTER);
        gTextSize(28); 
        noStroke();
        fill(0, 140);
        text(b.label, drawX + drawW / 2 + 2, drawY + drawH / 2 + 3);
        if (inGameMenuHovered === b.id) fill(255, 220, 0); else fill(255);
        text(b.label, drawX + drawW / 2, drawY + drawH / 2);
        pop();
      } catch (e) {}
      
      inGameMenuButtonRects.push({ id: b.id, x: drawX, y: drawY, w: drawW, h: drawH });
    }

    try {
      if (inGameMenuPrevHovered !== inGameMenuHovered) {
        inGameMenuPrevHovered = inGameMenuHovered;
        if (document.body) document.body.style.cursor = inGameMenuHovered ? 'pointer' : '';
      }
    } catch (e) {}

    pop();
  } catch (e) {}
}

function attemptStartGameMusic(reason = 'unknown') {
  if (!pendingGameMusicStart || gameMusicStarted || !gameMusic) return;
  verboseLog(`[game] attemptStartGameMusic reason=${reason}`);
  const startPlayback = () => {
    if (gameMusicStarted || !gameMusic) return;
    try { gameMusic.setVolume(musicVol * masterVol); } catch (volumeErr) {}
    try {
      if (typeof gameMusic.loop === 'function') {
        gameMusic.loop();
      } else if (typeof gameMusic.play === 'function') {
        gameMusic.play();
      } else {
        console.warn('[game] gameMusic has no loop/play');
        return;
      }
      gameMusicStarted = true;
      pendingGameMusicStart = false;
      verboseLog('[game] gameMusic playback started');
    } catch (startErr) {
      console.warn('[game] startPlayback failed', startErr);
    }
  };
  const tryResumeAudioContext = () => {
    if (typeof getAudioContext !== 'function') return false;
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state === 'running') return false;
      const resumeResult = ctx.resume?.();
      if (resumeResult && typeof resumeResult.then === 'function') {
        resumeResult.then(() => {
          verboseLog('[game] AudioContext.resume resolved');
          startPlayback();
        }).catch((err) => {
          console.warn('[game] AudioContext.resume rejected', err);
          startPlayback();
        });
        return true;
      }
    } catch (ctxErr) {
      console.warn('[game] tryResumeAudioContext threw', ctxErr);
    }
    return false;
  };
  if (typeof userStartAudio === 'function') {
    try {
      const maybePromise = userStartAudio();
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(() => {
          verboseLog('[game] userStartAudio resolved');
          startPlayback();
        }).catch((err) => {
          console.warn('[game] userStartAudio rejected', err);
          if (!tryResumeAudioContext()) startPlayback();
        });
        return;
      }
    } catch (userStartErr) {
      console.warn('[game] userStartAudio threw', userStartErr);
    }
  }
  if (tryResumeAudioContext()) return;
  startPlayback();
}

function playClickSFX() {
  if (clickSFX) {
    clickSFX.setVolume(sfxVol * masterVol);
    clickSFX.play();
  }
}

function unlockAudioAndStart(cb) {
  if (audioUnlocked) {
    cb && cb();
    return;
  }
  try {
    if (typeof userStartAudio === 'function') {
      userStartAudio().then(() => {
        audioUnlocked = true;
        verboseLog('[unlockAudioAndStart] userStartAudio resolved — starting menu music');
        startMenuMusicIfNeeded();
        cb && cb();
      }).catch(() => {
        try {
          getAudioContext().resume().then(() => {
            audioUnlocked = true;
            verboseLog('[unlockAudioAndStart] AudioContext.resume succeeded — starting menu music');
            startMenuMusicIfNeeded();
            cb && cb();
          }).catch(() => {
            audioUnlocked = true;
            verboseLog('[unlockAudioAndStart] resume rejected but marking audio unlocked');
            startMenuMusicIfNeeded();
            cb && cb();
          });
        } catch (e) {
          audioUnlocked = true;
          verboseLog('[unlockAudioAndStart] fallback unlock — starting menu music');
          startMenuMusicIfNeeded();
          cb && cb();
        }
      });
    } else {
      try { getAudioContext().resume(); } catch (e) {}
      audioUnlocked = true;
      verboseLog('[unlockAudioAndStart] no userStartAudio — audioUnlocked set');
      startMenuMusicIfNeeded();
      cb && cb();
    }
  } catch (e) { audioUnlocked = true; cb && cb(); }
}

function startMenuMusicIfNeeded() {
  if (!bgMusic) {
    console.warn('[startMenuMusicIfNeeded] bgMusic not loaded yet');
    return;
  }
  try {
    if (typeof bgMusic.setVolume === 'function') bgMusic.setVolume(musicVol * masterVol);

    if (typeof bgMusic.isPlaying === 'function') {
      if (!bgMusic.isPlaying()) {
        bgMusic.loop();
        verboseLog('[startMenuMusicIfNeeded] bgMusic.loop() called');
      }
    } else if (typeof bgMusic.loop === 'function') {
      bgMusic.loop();
      verboseLog('[startMenuMusicIfNeeded] bgMusic.loop() fallback called');
    } else if (typeof bgMusic.play === 'function') {
      bgMusic.play();
      verboseLog('[startMenuMusicIfNeeded] bgMusic.play() fallback called');
    }
  } catch (err) {
    console.warn('[startMenuMusicIfNeeded] playback error', err);
  }
}

function styleSmallButton(btn) {
  btn.style("background", "transparent");
  btn.style("border", "none");
  btn.style("cursor", "pointer");
  btn.style("color", "white");
  btn.style("text-shadow", "0 0 8px #ffffff60");
  btn.style('border-radius', '2px');
  if (btn.elt) {
    btn.elt.style.position = 'absolute';
  btn.style('background-image', `url('${MENU_BUTTON_TEXTURE_PATH}')`);
    btn.elt.style.zIndex = '10001';
  }
}

function ensureLoopFallbackBuffer() {
  if (!loopFallbackBuffer || loopFallbackBuffer.width !== width || loopFallbackBuffer.height !== height) {
    if (loopFallbackBuffer && typeof loopFallbackBuffer.remove === 'function') {
      try { loopFallbackBuffer.remove(); } catch (e) {}
    }
    loopFallbackBuffer = createGraphics(width, height);
    enforceCanvasSharpness(loopFallbackBuffer.drawingContext);
    loopFallbackBuffer.noSmooth();
  }
}

function showToast(message, type = 'info', duration = 3000) {
  try {
    if (typeof document === 'undefined') return;
    const id = 'game-toast-overlay';
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      container.style.position = 'fixed';
      container.style.right = '18px';
      container.style.top = '18px';
      container.style.zIndex = 99999;
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '8px';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'game-toast ' + String(type || 'info');
    el.style.minWidth = '180px';
    el.style.maxWidth = '420px';
    el.style.background = type === 'error' ? '#7b1e1e' : (type === 'warn' ? '#8a6d1f' : '#1f6f8f');
    el.style.color = '#fff';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';
    el.style.fontFamily = 'Arial, sans-serif';
    el.style.fontSize = '13px';
    el.style.opacity = '0';
    el.style.transition = 'opacity 220ms ease, transform 220ms ease';
    el.style.transform = 'translateY(-6px)';
    el.textContent = message;
    container.appendChild(el);
    
    void el.offsetWidth;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    const timeout = setTimeout(() => {
      try {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(() => { try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e) {} }, 240);
      } catch (e) {}
    }, duration || 3000);
    
    el.addEventListener('click', () => {
      clearTimeout(timeout);
      try { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 180); } catch (e) {}
    });
  } catch (err) {
    console.warn('[game] showToast failed', err);
  }
}


// ── Error display helper ──
(function(){
  function ensureError1El(){
    let el = document.getElementById('error1');
    if (!el) {
      el = document.createElement('div');
      el.id = 'error1';
      Object.assign(el.style, {
        position: 'fixed',
        right: '12px',
        bottom: '12px',
        background: 'rgba(220,20,60,0.95)',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: '6px',
        zIndex: 9999,
        fontFamily: 'sans-serif',
        fontSize: '14px',
        display: 'none',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)'
      });
      if (document.body) {
        document.body.appendChild(el);
      } else {
        document.addEventListener('DOMContentLoaded', function(){ try { document.body.appendChild(el); } catch(e){} });
      }
    }
    return el;
  }
  function showError1(name){
    const el = ensureError1El();
    let msg = 'Error 1: Has no functionality yet will be added later';
    try {
      if (name) {
        const short = String(name).trim();
        if (short) msg += ' (' + short + ')';
      }
    } catch(e){}
    el.textContent = msg;
    el.style.display = 'block';
    try { clearTimeout(el.__hideTimeout); } catch(e){}
    el.__hideTimeout = setTimeout(()=>{ try { el.style.display = 'none'; } catch(e){} }, 5000);
    if (typeof console !== 'undefined' && console.warn) console.warn(msg);
  }

  const combinedSelector = '#showTutorials, input[name="showTutorials"], .show-tutorials, #ShowTutorials, #enabledHub, input[name="enabledHub"], .enabled-hub, #EnabledHub, #enabledHUB';

  function delegatedHandler(e){
    try {
      const t = e.target;
      if (!t) return;
      if (typeof t.matches === 'function' && t.matches(combinedSelector)) {
        showError1();
        return;
      }
      const found = t.closest && typeof t.closest === 'function' && t.closest(combinedSelector);
      if (found) showError1();
    } catch(e) {}
  }

  document.addEventListener('change', delegatedHandler, true);
  document.addEventListener('input', delegatedHandler, true);


  try { window.showError1 = showError1; } catch(e) {}
})();


// Escape key is handled exclusively in game-input.js (capture phase, debounced)

// ── Audio unlock on first interaction ──
['pointerdown', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, () => {
    if (pendingGameMusicStart && !gameMusicStarted) {
      attemptStartGameMusic(`user-${evt}`);
    }
  });
});


function showSubSettings(label) {
  clearSubSettings();

  const cx = width / 2;
  const cy = height / 2;
  const panelW = 0.7 * width;
  const panelH = 0.7 * height;
  const panelLeft = cx - panelW / 2;
  const panelRight = cx + panelW / 2;
  const paddingX = panelW * 0.08;
  const labelX = panelLeft + paddingX;
  const controlX = panelLeft + panelW * 0.42;
  const controlWidth = panelRight - paddingX - controlX;
  const spacingY = panelH * 0.14;

  const ctx = createSettingsContext({
    labelX, controlX, controlWidth, panelH,
    startY: cy - panelH / 2 + panelH * 0.18,
    spacingY
  });

  const builder = CATEGORY_BUILDERS[label];
  if (builder) {
    builder(ctx);
  }

  const backY = cy + panelH / 2 - panelH * 0.12;
  const backWidth = panelW * 0.3;
  const backBG = createBgImg("assets/3-GUI/Button_BG.png", cx - backWidth / 2, backY - BACK_BUTTON_VERTICAL_OFFSET, backWidth, panelH * 0.08, '3');
  const backBtn = makeSmallBtn("← Back", cx - backWidth / 2, backY - BACK_BUTTON_VERTICAL_OFFSET, backWidth, panelH * 0.08, () => {
    playClickSFX();
    clearSubSettings();
    showSettingsMenu();
  });

  activeSettingElements.push(backBG, backBtn);
  applyCurrentTextSize();
}


  try { ensureLoadingOverlayDom(); overlayMessage = 'Loading assets...'; updateLoadingOverlayDom(); } catch (e) {}
